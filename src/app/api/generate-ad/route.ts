import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_MODEL = 'moonshotai/kimi-k2.5'

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      width: 600px; 
      min-height: 300px;
      max-height: 1200px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      overflow: hidden;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      height: 100%;
      min-height: 240px;
      display: flex;
      flex-direction: column;
    }
    .logo-placeholder {
      width: 100px;
      height: 50px;
      background: #f5f5f5;
      border: 2px dashed #ccc;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 11px;
      margin-bottom: 20px;
      flex-shrink: 0;
    }
    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .vertical-tag {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 11px;
      margin-bottom: 12px;
      flex-shrink: 0;
      align-self: flex-start;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 8px;
      text-align: center;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .location {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      justify-content: center;
    }
    .description {
      color: #555;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 15px;
      flex: 1;
      overflow: hidden;
    }
    .cta {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px 30px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      display: inline-block;
      flex-shrink: 0;
      align-self: center;
    }
    .footer {
      margin-top: auto;
      text-align: center;
      color: #999;
      font-size: 10px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-placeholder">[Image 1]</div>
    <div class="content">
      <div class="vertical-tag">{{VERTICAL}}</div>
      <h1>{{JOB_TITLE}}</h1>
      <div class="location">📍 {{LOCATION}}</div>
      <div class="description">{{DESCRIPTION}}</div>
      <div class="cta">Apply Now</div>
    </div>
    <div class="footer">Join our amazing team!</div>
  </div>
</body>
</html>`

const REQUIRED_PLACEHOLDERS = ['{{DESCRIPTION}}', '{{VERTICAL}}', '{{JOB_TITLE}}', '{{LOCATION}}']

function validateHtmlTemplate(html: string): { valid: boolean; error?: string } {
  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!html.includes(placeholder)) {
      return { valid: false, error: `Missing required placeholder: ${placeholder}` }
    }
  }
  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, vertical, jobFunction, location, customHtml } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Use custom HTML if provided, otherwise use default
    const htmlTemplate = customHtml?.trim() || DEFAULT_HTML_TEMPLATE

    // Validate custom HTML has required placeholders
    const validation = validateHtmlTemplate(htmlTemplate)
    if (customHtml && !validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const contextPrompt = `Write a VERY SHORT job ad - just 1-2 sentences (max 100 words total).

Job: ${jobFunction || 'Position'}
Company: ${vertical || 'Our Company'}
Location: ${location || 'Remote'}

User requirements: ${prompt}

Write only the ad text - no headers, no bullet points, no markdown. Just 1-2 punchy sentences that fit in a small ad banner. Keep it under 100 words.`

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: contextPrompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error?.message || errorData.message || `API error: ${response.status}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0]?.message) {
      throw new Error('Invalid API response format')
    }
    
    const message = data.choices[0].message
    
    // For reasoning models, content might be in reasoning field
    const generatedContent = message.content?.trim() || message.reasoning?.trim() || ''

    // If still empty, check for refusal
    if (!generatedContent && message.refusal) {
      throw new Error(message.refusal)
    }
    
    // If no content generated, use fallback
    if (!generatedContent) {
      throw new Error('No content generated from AI')
    }

    // Extract only the first very short paragraph (keep it concise for banner)
    // Take first 2 sentences max
    const sentences = generatedContent.split(/[.!?]+/).filter((s: string) => s.trim())
    let finalContent = sentences.slice(0, 2).join('. ').trim()
    if (!finalContent) {
      finalContent = generatedContent.substring(0, 150).trim()
    }
    // Ensure it ends with punctuation
    if (finalContent && !/[.!?]$/.test(finalContent)) {
      finalContent += '.'
    }

    // Fill the template with data
    const html = htmlTemplate
      .replace('{{VERTICAL}}', vertical || 'Hiring')
      .replace('{{JOB_TITLE}}', jobFunction || 'Exciting Opportunity')
      .replace('{{LOCATION}}', location || 'Remote')
      .replace('{{DESCRIPTION}}', finalContent || 'Join our team!')

    return NextResponse.json({
      html,
      content: finalContent,
      template: htmlTemplate
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Generate ad error:', message)
    return NextResponse.json({
      error: `Failed to generate: ${message}`,
      hint: 'Check if NVIDIA_API_KEY is set correctly in .env.local'
    }, { status: 500 })
  }
}
