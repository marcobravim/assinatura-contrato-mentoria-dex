// Smoke end-to-end: loga como admin, dispara create-contract com dados fake,
// imprime resultado da edge function. Valida Autentique sandbox + DOCX→PDF + DB.

const SUPABASE_URL = 'https://mlvcghqxchrismnxbnho.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdmNnaHF4Y2hyaXNtbnhibmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODgwMjcsImV4cCI6MjA5MjQ2NDAyN30.8T4XTji6QK_YbIZhx4-h1LSh2cN7uVu9ATF8ViwiyCs'
const ADMIN_EMAIL = 'contato@crismiura.com.br'
const ADMIN_PASSWORD = 'Crismiura@2026'

// 1. Login
const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const loginData = await loginRes.json()
if (!loginData.access_token) throw new Error('login failed: ' + JSON.stringify(loginData))
console.log('✅ login OK — user:', loginData.user.email)
const jwt = loginData.access_token

// 2. Payload de teste — contrato PRAZO completo
const payload = {
  modalidade: 'INDIVIDUAL',
  data_inicio: '2026-05-15',
  valor_entrada_reserva: 1997,
  participante: {
    nome: 'Dra. Teste Playwright',
    cpf_cnpj: '12345678900',
    endereco: 'Av. Paulista, 1000, Bela Vista, São Paulo/SP, CEP 01310-100',
    telefone: '11999998888',
    email: 'teste-sandbox@lancio.com.br',
  },
  socio: null,
  pagamento: {
    forma: 'PRAZO',
    valor_total: 24997,
    entrada_valor: 1997,
    entrada_data: '2026-05-15',
    parcelas_count: 10,
    parcela_valor: 2300,
    parcela_primeira_data: '2026-06-10',
  },
}

console.log('\nEnviando pro edge function create-contract...')
const t0 = Date.now()
const res = await fetch(`${SUPABASE_URL}/functions/v1/create-contract`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
    apikey: ANON_KEY,
  },
  body: JSON.stringify(payload),
})
const ms = Date.now() - t0
const body = await res.text()
console.log(`status ${res.status} em ${ms}ms`)
console.log('body:', body.slice(0, 2000))

if (res.ok) {
  const r = JSON.parse(body)
  console.log('\n✅ contrato criado')
  console.log('  contract_id:', r.contract_id)
  console.log('  autentique_document_id:', r.autentique_document_id)
  console.log('  short_link:', r.short_link)
} else {
  console.log('\n❌ falhou')
  process.exit(1)
}
