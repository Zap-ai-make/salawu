import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useAuth } from '../context/AuthContext'
import ClientForm from '../components/ClientForm'

function Formulaire() {
  const navigate = useNavigate()
  const { addClient } = useClients()
  const { userProfile, activeStore } = useAuth()

  // Le brouillon n'est conservé que sous l'identité de la boutique connectée, et
  // seulement une fois son contexte résolu (même garde que les soldes réseau).
  const draftScopeId =
    userProfile?.storeId && activeStore?.id === userProfile.storeId
      ? userProfile.storeId
      : null

  const handleSubmit = async (newClient) => {
    await addClient(newClient)
    navigate('/clients')
  }

  return (
    <ClientForm onSubmit={handleSubmit} draftScopeId={draftScopeId} />
  )
}

export default Formulaire
