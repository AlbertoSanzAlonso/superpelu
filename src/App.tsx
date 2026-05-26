import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { BookingPage } from '@/pages/BookingPage'
import { AdminAgendaPage } from '@/pages/AdminAgendaPage'
import { CustomerHistoryPage } from '@/pages/CustomerHistoryPage'
import { CustomersPage } from '@/pages/CustomersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reservar" element={<BookingPage />} />
        <Route path="/agenda" element={<AdminAgendaPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/clientes/:phone" element={<CustomerHistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
