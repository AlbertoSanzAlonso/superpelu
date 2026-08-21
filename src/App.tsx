import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CookieConsentBanner } from '@/components/layout/CookieConsentBanner'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { HomePage } from '@/pages/HomePage'
import { SalonPage } from '@/pages/SalonPage'
import { CookiePolicyPage } from '@/pages/CookiePolicyPage'
import { BookingPage } from '@/pages/BookingPage'
import { AdminAgendaPage } from '@/pages/AdminAgendaPage'
import { CustomerHistoryPage } from '@/pages/CustomerHistoryPage'
import { SalonAppointmentsPage } from '@/pages/SalonAppointmentsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { ScheduleManagementPage } from '@/pages/ScheduleManagementPage'
import { AdminServicesPage } from '@/pages/AdminServicesPage'
import { StaffManagementPage } from '@/pages/StaffManagementPage'
import StatsPage from '@/pages/StatsPage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/salon" element={<SalonPage />} />
        <Route path="/politica-de-cookies" element={<CookiePolicyPage />} />
        <Route path="/reservar" element={<BookingPage />} />
        <Route path="/agenda" element={<AdminAgendaPage />} />
        <Route path="/horarios" element={<ScheduleManagementPage />} />
        <Route path="/servicios" element={<AdminServicesPage />} />
        <Route path="/personal" element={<StaffManagementPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/clientes/citas" element={<SalonAppointmentsPage />} />
        <Route path="/clientes/:phone" element={<CustomerHistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieConsentBanner />
    </BrowserRouter>
  )
}
