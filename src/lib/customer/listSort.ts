import { formatCustomerDisplayName } from '@/lib/customer/name'
import type { Customer } from '@/types/customers'

export type CustomerListSort = 'name' | 'newest' | 'oldest'

export const CUSTOMER_LIST_SORT_OPTIONS: {
  value: CustomerListSort
  label: string
}[] = [
  { value: 'name', label: 'Alfabético' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
]

function customerSortName(customer: Customer): string {
  return formatCustomerDisplayName(customer.firstName, customer.lastName)
}

function compareByName(a: Customer, b: Customer): number {
  const byName = customerSortName(a).localeCompare(customerSortName(b), 'es', {
    sensitivity: 'base',
  })
  if (byName !== 0) return byName
  return a.phone.localeCompare(b.phone)
}

/** Ordena la lista de clientes: alfabético (defecto), ficha más reciente o más antigua. */
export function sortCustomerList(
  customers: Customer[],
  sort: CustomerListSort,
): Customer[] {
  const rows = [...customers]
  if (sort === 'newest') {
    return rows.sort((a, b) => {
      const byCreated = b.createdAt.localeCompare(a.createdAt)
      if (byCreated !== 0) return byCreated
      return compareByName(a, b)
    })
  }
  if (sort === 'oldest') {
    return rows.sort((a, b) => {
      const byCreated = a.createdAt.localeCompare(b.createdAt)
      if (byCreated !== 0) return byCreated
      return compareByName(a, b)
    })
  }
  return rows.sort(compareByName)
}
