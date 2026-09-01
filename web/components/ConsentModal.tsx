'use client'

import { Button } from './Button'

export function ConsentModal({ onAgree, onCancel }: { onAgree: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[15px] max-w-md w-full p-6">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-3">Permissão para busca facial</h2>
        <p className="text-orca-preto-marca mb-6">
          Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os
          dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onAgree}>Estou de acordo</Button>
        </div>
      </div>
    </div>
  )
}
