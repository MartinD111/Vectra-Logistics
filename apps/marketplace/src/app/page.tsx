import { redirect } from 'next/navigation'

// The Marketplace home is the board. Redirect the bare root there.
export default function MarketplaceHome() {
  redirect('/board')
}
