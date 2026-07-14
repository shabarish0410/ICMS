import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="p-8 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Supabase Connection Test</h1>
      <p className="text-gray-500">Fetched from <code>todos</code> table:</p>
      <ul className="list-disc pl-5 space-y-1">
        {todos?.map((todo: any) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
        {(!todos || todos.length === 0) && (
          <li className="text-gray-400">No items found in <code>todos</code> table (or table doesn't exist yet).</li>
        )}
      </ul>
    </div>
  )
}
