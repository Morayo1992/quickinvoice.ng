import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res){
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  
  if(req.body.event === "charge.success"){
    const email = req.body.data.customer.email
    
    // find user by email in profiles table (you need to save email on signup)
    const { data } = await supabase.from("profiles").select("*").eq("email", email).single()
    
    if(data){
      await supabase.from("profiles").update({
        is_pro: true,
        pro_expires_at: new Date(Date.now()+30*24*60*60*1000)
      }).eq("id", data.id)
    }
  }
  
  res.status(200).json({ok:true})
}