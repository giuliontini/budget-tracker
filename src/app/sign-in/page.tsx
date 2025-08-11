'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabaseBrowser } from '@/utils/supabase/supabaseBrowser'

export default function SignIn() {
  const router = useRouter()

  useEffect(() => {
    const { data : sub } = supabaseBrowser.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          router.push('/dashboard')
        }
      }
    )
    return () => sub.subscription.unsubscribe()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Auth
         supabaseClient={supabaseBrowser}
         theme="dark"
         appearance={{
           theme: ThemeSupa,
           className: {
             input:
               'bg-black text-white placeholder-gray-300 border border-gray-700 focus:border-white focus:ring-0',
             label: 'text-white',
             // make the error/info message readable on black
             message:
               'bg-black text-white border border-gray-700 rounded-md px-3 py-2',
           },
         }}
         providers={['github', 'google']}
         view="sign_in"
      />
    </div>
  )
}
