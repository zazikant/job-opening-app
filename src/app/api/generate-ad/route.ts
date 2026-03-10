import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_MODEL = 'moonshotai/kimi-k2.5'

const HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      width: 600px; 
      min-height: 400px;
      max-height: 1200px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .logo-placeholder {
      width: 120px;
      height: 60px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 12px;
      margin-bottom: 30px;
    }
    h1 {
      color: #333;
      font-size: 32px;
      margin-bottom: 20px;
      text-align: center;
    }
    .vertical-tag {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .job-title {
      color: #222;
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .location {
      color: #666;
      font-size: 18px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .description {
      color: #555;
      font-size: 16px;
      line-height: 1.8;
      margin-bottom: 30px;
      white-space: pre-line;
    }
    .cta {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 40px;
      border-radius: 30px;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      display: inline-block;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-placeholder">[Image 1]</div>
    <div class="vertical-tag">{{VERTICAL}}</div>
    <h1>{{JOB_TITLE}}</h1>
    <div class="location">📍 {{LOCATION}}</div>
    <div class="description">{{DESCRIPTION}}</div>
    <div class="cta">Apply Now</div>
    <div class="footer">Join our amazing team!</div>
  </div>
</body>
</html>`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, vertical, jobFunction, location } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const contextPrompt = `Write a short job ad description (2-3 sentences, engaging tone). 

Job: ${jobFunction || 'Position'} at ${vertical || 'Company'}
Location: ${location || 'Remote'}

User requirements: ${prompt}

Return ONLY the ad text, no explanations, no markdown.`

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
    let generatedContent = message.content?.trim() || message.reasoning?.trim() || ''

    // If still empty, check for refusal
    if (!generatedContent && message.refusal) {
      throw new Error(message.refusal)
    }
    
    // If no content generated, use fallback
    if (!generatedContent) {
      throw new Error('No content generated from AI')
    }

    // Extract only the first short paragraph (before --- or first line break)
    // This model tends to output multiple variations, we only want one short ad
    const firstPara = generatedContent.split(/^---+$/m)[0]
      .split('\n\n')[0]
      .replace(/^[#*]+\s*/gm, '')  // Remove markdown headers
      .replace(/\n/g, ' ')
      .trim()
    
    // Limit to reasonable length for ad
    const finalContent = firstPara.length > 300 ? firstPara.substring(0, 300) + '...' : firstPara

    // Fill the template with data
    const html = HTML_TEMPLATE
      .replace('{{VERTICAL}}', vertical || 'Hiring')
      .replace('{{JOB_TITLE}}', jobFunction || 'Exciting Opportunity')
      .replace('{{LOCATION}}', location || 'Remote')
      .replace('{{DESCRIPTION}}', finalContent || 'Join our team!')

    return NextResponse.json({
      html,
      content: finalContent,
      template: HTML_TEMPLATE
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
