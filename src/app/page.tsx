import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Job Openings</h1>
          <nav className="space-x-4">
            <Link href="/jobs" className="text-black hover:text-indigo-600">
              Dashboard
            </Link>
            <Link 
              href="/jobs/add" 
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Add Job
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Manage Your Job Openings
          </h2>
          <p className="text-xl text-black mb-8">
            Add positions, query with AI, and send vacancy emails
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Link href="/jobs/add" className="block">
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition border border-gray-100">
                <div className="text-4xl mb-4">➕</div>
                <h3 className="text-lg font-semibold text-gray-900">Add Job</h3>
                <p className="text-black mt-2">
                  Upload new job opening with creative image
                </p>
              </div>
            </Link>

            <Link href="/jobs" className="block">
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition border border-gray-100">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
                <p className="text-black mt-2">
                  View all job openings in a table
                </p>
              </div>
            </Link>

            <Link href="/query" className="block">
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition border border-gray-100">
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-gray-900">AI Query</h3>
                <p className="text-black mt-2">
                  Search jobs using natural language
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
