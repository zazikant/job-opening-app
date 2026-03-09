import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_MODEL = 'moonshotai/kimi-k2.5'

interface QueryState {
  query: string
  sql: string | null
  results: Record<string, unknown>[] | null
  error: string | null
}

async function generateSQL(query: string): Promise<string> {
  const systemPrompt = `You are a SQL expert. Given the user's question, 
generate a valid PostgreSQL SELECT query for the job_openings table.

Table schema:
- id (UUID, primary key)
- vertical (VARCHAR)
- job_function (VARCHAR)
- location (VARCHAR)
- date_added (DATE)
- creative_url (TEXT)
- mail_send_date (DATE)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Rules:
- Only generate SELECT queries
- Use proper SQL syntax
- Do not use semicolons at the end
- If the question cannot be answered with SQL, return "ERROR: Cannot generate SQL"

User question: "${query}"

Generate ONLY the SQL query, no explanation.`

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`)
  }

  const data = await response.json()
  const sql = data.choices[0]?.message?.content?.trim() || ''
  
  return sql
}

async function executeSQL(supabase: ReturnType<typeof createClient>, sql: string): Promise<Record<string, unknown>[]> {
  const forbidden = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
  const upperSQL = sql.toUpperCase()
  
  if (forbidden.some(kw => upperSQL.includes(kw))) {
    throw new Error('Only SELECT queries allowed for security')
  }

  const { data, error } = await supabase.rpc('exec_sql', { query: sql })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
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
      sql: null,
      results: null,
      error: null,
    }

    try {
      state.sql = await generateSQL(state.query)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      state.error = `SQL generation failed: ${message}`
      return NextResponse.json({ 
        query: state.query,
        sql: null,
        results: null,
        error: state.error 
      }, { status: 200 })
    }

    if (!state.sql || state.sql.startsWith('ERROR:')) {
      state.error = state.sql || 'Failed to generate SQL'
      return NextResponse.json({
        query: state.query,
        sql: null,
        results: null,
        error: state.error
      }, { status: 200 })
    }

    try {
      state.results = await executeSQL(supabase, state.sql)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      state.error = `Query execution failed: ${message}`
      return NextResponse.json({
        query: state.query,
        sql: state.sql,
        results: null,
        error: state.error
      }, { status: 200 })
    }

    return NextResponse.json({
      query: state.query,
      sql: state.sql,
      results: state.results,
      error: null
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Server error: ${message}` 
    }, { status: 500 })
  }
}
