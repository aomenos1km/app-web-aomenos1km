import { redirect } from 'next/navigation'

export default function CheckinByIdPage({ params }: { params: { id: string } }) {
  const id = encodeURIComponent(params.id || '')
  redirect(`/publico/checkin?id=${id}`)
}
