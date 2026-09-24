const SUPABASE_URL = "https://owsismprvbndwlaktohz.supabase.co"
const SUPABASE_KEY = "sb_publishable_8auPuaDH5Iq65d_6LwPEKQ_yilaScba"
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

let currentUser = null;

async function getUser(){
  let { data: { user } } = await supabaseClient.auth.getUser()
  if(!user){
    let email = `user_${Date.now()}@quickinvoice.ng`
    let { data, error } = await supabaseClient.auth.signUp({ email, password: "Password123!" })
    if(error){ console.error(error); return null; }
    user = data.user
    
    if(user){
      await supabaseClient.from("profiles").insert({
        id: user.id,
        email: email,
        business_name: document.getElementById("bizName")?.value || "My Business",
        is_pro: false
      })
    }
  }
  currentUser = user
  return user
}

function addItem(){
  document.getElementById("items").innerHTML += `
  <div class="item-row">
    <input placeholder="Item" class="item-name">
    <input type="number" placeholder="Qty" class="item-qty" value="1">
    <input type="number" placeholder="Price" class="item-price">
  </div>`
}

async function generateInvoice(){
  const user = await getUser()
  if(!user) return alert("Please refresh page")
  
  let { data: invoices } = await supabaseClient.from("invoices").select("*").eq("user_id", user.id)
  let { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single()
  
  if(!profile?.is_pro && invoices && invoices.length >= 3){
    alert("Free limit reached (3/month). Please upgrade to Pro for ₦3,000")
    window.location.href = "https://paystack.com/pay/your-link"
    return
  }

  const bizName = document.getElementById("bizName").value
  const clientName = document.getElementById("clientName").value
  const names = document.querySelectorAll(".item-name")
  const qtys = document.querySelectorAll(".item-qty")
  const prices = document.querySelectorAll(".item-price")
  
  let items = []
  let total = 0
  for(let i=0; i<names.length; i++){
    let qty = parseInt(qtys[i].value)||1
    let price = parseInt(prices[i].value)||0
    if(names[i].value){
      items.push({name: names[i].value, qty, price})
      total += qty*price
    }
  }

  if(total === 0) return alert("Add at least one item with price")

  await supabaseClient.from("profiles").upsert({
    id: user.id,
    business_name: bizName
  }, { onConflict: 'id' })

  let { error } = await supabaseClient.from("invoices").insert({
    user_id: user.id,
    client_name: clientName,
    items: items,
    total: total,
    invoice_number: "QI-"+Date.now().toString().slice(-5)
  })
  
  if(error){ console.error(error); return alert("Save failed: "+error.message) }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  doc.text(bizName, 20, 20)
  doc.text(`Invoice for: ${clientName}`, 20, 30)
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40)
  let y = 60
  items.forEach(it => {
    doc.text(`${it.name} x${it.qty} - ₦${it.price * it.qty}`, 20, y)
    y+=10
  })
  doc.text(`TOTAL: ₦${total}`, 20, y+10)
  doc.text("Thank you!", 20, y+20)
  doc.text("Powered by QuickInvoice.ng", 20, y+30)
  doc.save(`Invoice-${clientName}.pdf`)
  
  alert("Invoice saved! PDF downloaded.")
  window.location.href = "dashboard.html"
}

async function loadDashboard(){
  const user = await getUser()
  let { data: invoices } = await supabaseClient.from("invoices").select("*").eq("user_id", user.id).order("created_at", {ascending:false})
  let { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single()
  
  let usageText = profile?.is_pro ? "Pro User - Unlimited" : `Free: ${invoices?.length||0}/3 used`
  if(document.getElementById("usage")) document.getElementById("usage").innerText = usageText
  
  let list = document.getElementById("invoiceList")
  if(list){
    list.innerHTML = (invoices||[]).map(inv => `
      <div style="background:white;padding:15px;border-radius:12px;margin:10px 0">
        <b>${inv.invoice_number}</b> - ${inv.client_name}<br>
        ₦${inv.total} - ${new Date(inv.created_at).toLocaleDateString()}
      </div>
    `).join("") || "<p>No invoices yet</p>"
  }
}