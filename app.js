const SUPABASE_URL = "https://owsismprvbndwlaktohz.supabase.co"
const SUPABASE_KEY = "sb_publishable_8auPuaDH5Iq65d_6LwPEKQ_yilaScba"
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

function getUser(){
  let userId = localStorage.getItem("qi_user_id")
  if(!userId){
    userId = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2,7)
    localStorage.setItem("qi_user_id", userId)
  }
  return { id: userId }
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
  const user = getUser()

  let { data: invoices } = await supabaseClient.from("invoices").select("*").eq("user_id", user.id)

  if(invoices && invoices.length >= 3){
    // Check pro in localStorage
    let isPro = localStorage.getItem("is_pro") === "true"
    if(!isPro){
      alert("Free limit reached (3/month). Please upgrade to Pro for ₦3,000")
      return
    }
  }

  const bizName = document.getElementById("bizName").value
  const clientName = document.getElementById("clientName").value
  if(!clientName) return alert("Enter client name")

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
  if(total === 0) return alert("Add at least one item")

  // Save business name
  localStorage.setItem("biz_name", bizName)

  let { error } = await supabaseClient.from("invoices").insert({
    user_id: user.id,
    client_name: clientName,
    items: items,
    total: total,
    invoice_number: "QI-"+Date.now().toString().slice(-5)
  })

  if(error){
    console.error(error)
    return alert("Supabase save failed: "+error.message)
  }

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

  alert("Done! Invoice saved & PDF downloaded")
  window.location.href = "dashboard.html"
}

async function loadDashboard(){
  const user = getUser()
  let { data: invoices, error } = await supabaseClient.from("invoices").select("*").eq("user_id", user.id).order("created_at", {ascending:false})

  if(error) console.error(error)

  let usageText = `Free: ${invoices?.length||0}/3 used`
  if(localStorage.getItem("is_pro") === "true") usageText = "Pro User - Unlimited"
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