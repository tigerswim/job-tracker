// src/components/DebugComponent.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugComponent() {
  const [results, setResults] = useState<string[]>([])
  const [testContactId, setTestContactId] = useState<string>('')

  // Hide debug component based on environment variable
  const showDebug = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true'
  
  // If debug is disabled, return null (component won't render)
  if (!showDebug) {
    return null
  }

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testCompleteWorkflow = async () => {
    addResult('🚀 Starting complete workflow test...')
    
    try {
      // Step 1: Check user authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        addResult(`❌ Authentication failed: ${userError?.message || 'No user'}`)
        return
      }
      addResult(`✅ User authenticated: ${user.email}`)

      // Step 2: Test contacts table access
      addResult('📋 Testing contacts table...')
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('user_id', user.id)
        .limit(5)

      if (contactsError) {
        addResult(`❌ Contacts error: ${contactsError.message}`)
        return
      }
      addResult(`✅ Contacts accessible: Found ${contacts?.length || 0} contacts`)

      // Step 3: Create a test contact if none exist
      let contactId = contacts && contacts.length > 0 ? contacts[0].id : null
      
      if (!contactId) {
        addResult('👤 Creating test contact...')
        const { data: newContact, error: createError } = await supabase
          .from('contacts')
          .insert([{
            name: 'Test Contact for Interactions',
            email: 'test@interaction.com',
            user_id: user.id
          }])
          .select()
          .single()

        if (createError) {
          addResult(`❌ Contact creation failed: ${createError.message}`)
          return
        }
        contactId = newContact.id
        addResult(`✅ Test contact created: ${contactId}`)
      } else {
        addResult(`✅ Using existing contact: ${contactId}`)
      }

      setTestContactId(contactId)

      // Step 4: Test interactions table access
      addResult('🔗 Testing interactions table access...')
      const { data: interactions, error: interactionsError } = await supabase
        .from('interactions')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (interactionsError) {
        addResult(`❌ Interactions table error: ${interactionsError.message}`)
        if (interactionsError.code === '42P01') {
          addResult('💡 Table does not exist - check your database schema')
        }
        return
      }
      addResult('✅ Interactions table accessible')

      // Step 5: Test interaction creation for all types
      const typesToTest = ['email', 'phone', 'video_call', 'linkedin', 'meeting', 'other']
      
      for (const type of typesToTest) {
        addResult(`➕ Testing ${type} interaction creation...`)
        const testInteraction = {
          contact_id: contactId,
          type: type as any,
          date: new Date().toISOString().split('T')[0],
          notes: `Test ${type} interaction from debug component`,
          summary: `Test ${type} interaction`,
          user_id: user.id
        }

        const { data: newInteraction, error: createInteractionError } = await supabase
          .from('interactions')
          .insert([testInteraction])
          .select()
          .single()

        if (createInteractionError) {
          addResult(`❌ ${type} interaction creation failed: ${createInteractionError.message}`)
        } else {
          addResult(`✅ ${type} interaction created successfully: ${newInteraction.id}`)
          
          // Clean up test interaction
          await supabase.from('interactions').delete().eq('id', newInteraction.id)
          addResult(`🧹 ${type} test interaction cleaned up`)
        }
      }

      // Step 6: Clean up test contact if we created it
      if (contacts?.length === 0) {
        const { error: deleteContactError } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId)

        if (deleteContactError) {
          addResult(`⚠️ Cleanup warning: ${deleteContactError.message}`)
        } else {
          addResult('✅ Test contact deleted')
        }
      }

      addResult('🎉 Complete workflow test PASSED!')

    } catch (error) {
      addResult(`❌ Exception: ${error}`)
    }
  }

  const testRLSPolicies = async () => {
    addResult('🔒 Testing RLS policies...')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addResult('❌ No authenticated user')
        return
      }

      // Test if we can see all interactions (should be filtered by RLS)
      const { data, error } = await supabase
        .from('interactions')
        .select('user_id')
        .neq('user_id', user.id) // Try to get other users' data

      if (error) {
        addResult(`❌ RLS test failed: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        addResult('⚠️ RLS may not be working - can see other users\' data')
      } else {
        addResult('✅ RLS working correctly - no unauthorized data visible')
      }

    } catch (error) {
      addResult(`❌ RLS test exception: ${error}`)
    }
  }

  const checkTableSchema = async () => {
    addResult('📋 Checking table schemas...')
    
    try {
      // Check interactions table structure
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .limit(0) // Just get column info

      if (error) {
        addResult(`❌ Schema check failed: ${error.message}`)
        if (error.code === '42P01') {
          addResult('💡 Table does not exist - run the SQL schema creation script')
        }
      } else {
        addResult('✅ Interactions table exists and is accessible')
      }

    } catch (error) {
      addResult(`❌ Schema check exception: ${error}`)
    }
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-2">🔧 Enhanced Debug Tools</h3>
      
      <div className="space-x-2 mb-4 flex flex-wrap gap-2">
        <button
          onClick={testCompleteWorkflow}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          🧪 Full Workflow Test
        </button>
        <button
          onClick={testRLSPolicies}
          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
        >
          🔒 Test RLS Policies
        </button>
        <button
          onClick={checkTableSchema}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          📋 Check Schema
        </button>
        <button
          onClick={() => setResults([])}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          🗑️ Clear Results
        </button>
      </div>

      {testContactId && (
        <div className="mb-4 p-2 bg-blue-50 rounded">
          <p className="text-sm text-blue-800">
            <strong>Test Contact ID:</strong> {testContactId}
          </p>
        </div>
      )}

      <div className="bg-white rounded border p-3 max-h-80 overflow-y-auto">
        {results.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No results yet. Click "Full Workflow Test" to run comprehensive tests.
          </p>
        ) : (
          <div className="space-y-1">
            {results.map((result, index) => (
              <div key={index} className="text-sm font-mono whitespace-pre-wrap">
                {result}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-600">
        <strong>What this tests:</strong>
        <ul className="list-disc list-inside mt-1">
          <li>User authentication status</li>
          <li>Database table access and permissions</li>
          <li>Contact and interaction CRUD operations</li>
          <li>Row Level Security (RLS) policy enforcement</li>
          <li>All interaction types including video_call</li>
          <li>Complete workflow from contact creation to interaction management</li>
        </ul>
      </div>
    </div>
  )
}