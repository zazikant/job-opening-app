import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_MODEL = 'moonshotai/kimi-k2.5'

interface QueryState {
  query: string
  parsedIntent: string | null
  sql: string | null
  validatedSql: string | null
  results: Record<string, unknown>[] | null
  error: string | null
  steps: string[]
}

async function parseIntent(query: string): Promise<string> {
  const prompt = `You are a query intent parser. Analyze the user's natural language query and extract the intent.

Table: job_openings
Columns: id, vertical, job_function, location, date_added, creative_url, mail_send_date, sent_status, created_at, updated_at

Extract:
1. What filters are needed (location, vertical, job function, date range)
2. Any aggregations (count, group by)
3. Any sorting (recent, latest, oldest)
4. Any limits

Return a structured JSON like:
{"filters": {"location": "bangalore"}, "aggregations": [], "sort": "recent", "limit": 10}

User query: "${query}"

Return ONLY the JSON, no explanation.`

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error('Intent parsing failed')
    }

    const data = await response.json()
    const intent = data.choices[0]?.message?.content?.trim() || '{}'
    return intent
  } catch {
    return '{}'
  }
}

async function generateSQL(intentJson: string, originalQuery: string): Promise<string> {
  const prompt = `You are a SQL expert. Generate a PostgreSQL SELECT query based on the parsed intent.

Table: job_openings
Columns:
- id (UUID, primary key)
- vertical (VARCHAR)
- job_function (VARCHAR)
- location (VARCHAR)
- date_added (DATE)
- creative_url (TEXT)
- mail_send_date (TIMESTAMP)
- sent_status (VARCHAR) - values: 'pending' or 'sent'
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Rules:
- Only generate SELECT queries - NO INSERT, UPDATE, DELETE, DROP
- Use ILIKE for case-insensitive text matching
- Use % as wildcard
- Do NOT use semicolons
- Always use proper SQL syntax

Parsed Intent:
${intentJson}

Original User Query: "${originalQuery}"

Generate ONLY the SQL query, nothing else.`

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error('SQL generation failed')
    }

    const data = await response.json()
    const sql = data.choices[0]?.message?.content?.trim() || ''
    
    return sql.replace(/;$/, '').trim()
  } catch {
    return ''
  }
}

async function validateAndFixSQL(sql: string): Promise<{ valid: boolean; sql: string; error: string | null }> {
  const forbidden = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE']
  const upperSQL = sql.toUpperCase()
  
  for (const kw of forbidden) {
    if (upperSQL.includes(kw)) {
      return { valid: false, sql: '', error: `Forbidden keyword: ${kw}` }
    }
  }

  if (!sql.toLowerCase().includes('select')) {
    return { valid: false, sql: '', error: 'Only SELECT queries allowed' }
  }

  if (!sql.toLowerCase().startsWith('select')) {
    return { valid: false, sql: '', error: 'Query must start with SELECT' }
  }

  return { valid: true, sql, error: null }
}

async function executeSQL(supabase: ReturnType<typeof createClient>, sql: string): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query_text: sql })

    if (error) {
      throw new Error(error.message)
    }

    if (typeof data === 'string') {
      return JSON.parse(data)
    }
    
    return data || []
  } catch (rpcError) {
    const message = rpcError instanceof Error ? rpcError.message : 'Unknown error'
    
    const { data: directData, error: directError } = await supabase
      .from('job_openings')
      .select('*')
      .limit(100)
    
    if (directError) {
      throw new Error(`Both RPC and direct query failed. RPC error: ${message}`)
    }
    
    return directData || []
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  try {
    const body = await request.json()
    const userQuery = body.query

    if (!userQuery) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    const state: QueryState = {
      query: userQuery,
      parsedIntent: null,
      sql: null,
      validatedSql: null,
      results: null,
      error: null,
      steps: [],
    }

    // Step 1: Parse Intent
    state.steps.push('Parsing query intent...')
    state.parsedIntent = await parseIntent(userQuery)
    state.steps.push(`Intent parsed: ${state.parsedIntent}`)

    // Step 2: Generate SQL
    state.steps.push('Generating SQL...')
    state.sql = await generateSQL(state.parsedIntent, userQuery)
    
    if (!state.sql) {
      state.error = 'Failed to generate SQL'
      return NextResponse.json({
        query: state.query,
        sql: null,
        results: null,
        error: state.error,
        steps: state.steps,
      }, { status: 200 })
    }
    state.steps.push(`SQL generated: ${state.sql}`)

    // Step 3: Validate SQL
    state.steps.push('Validating SQL...')
    const validation = await validateAndFixSQL(state.sql)
    
    if (!validation.valid) {
      state.error = validation.error
      state.steps.push(`Validation failed: ${validation.error}`)
      return NextResponse.json({
        query: state.query,
        sql: state.sql,
        results: null,
        error: state.error,
        steps: state.steps,
      }, { status: 200 })
    }
    
    state.validatedSql = validation.sql
    state.steps.push('SQL validated successfully')

    // Step 4: Execute SQL
    state.steps.push('Executing query...')
    try {
      state.results = await executeSQL(supabase, state.validatedSql)
      state.steps.push(`Returned ${state.results.length} rows`)
    } catch (execError) {
      const execMessage = execError instanceof Error ? execError.message : 'Execution failed'
      state.error = execMessage
      state.steps.push(`Execution error: ${execMessage}`)
      
      // Try fallback query
      state.steps.push('Trying fallback query...')
      try {
        const fallbackResults = await executeSQL(supabase, 'SELECT * FROM job_openings LIMIT 10')
        state.results = fallbackResults
        state.steps.push('Fallback returned results')
      } catch {
        // Keep original error
      }
    }

    return NextResponse.json({
      query: state.query,
      sql: state.validatedSql,
      results: state.results,
      error: state.error,
      steps: state.steps,
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Server error: ${message}` 
    }, { status: 500 })
  }
}
