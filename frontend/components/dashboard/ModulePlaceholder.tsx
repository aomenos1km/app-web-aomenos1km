import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ModulePlaceholderProps {
  titulo: string
  descricao: string
  itens: string[]
}

export default function ModulePlaceholder({ titulo, descricao, itens }: ModulePlaceholderProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próxima etapa deste módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {itens.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
