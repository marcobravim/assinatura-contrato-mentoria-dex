import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { NewContract } from '@/pages/NewContract'
import { ContractDetail } from '@/pages/ContractDetail'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/novo" element={<ProtectedRoute><NewContract /></ProtectedRoute>} />
        <Route path="/contrato/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
