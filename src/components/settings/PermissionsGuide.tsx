import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, Info } from 'lucide-react';

export function PermissionsGuide() {
  return (
    <Card className="mt-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <Info className="h-5 w-5" />
          Guide d'utilisation
        </CardTitle>
        <CardDescription className="text-blue-700 dark:text-blue-300">
          Comment utiliser les permissions dans votre code
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            1. Utiliser le hook usePermissions
          </h4>
          <div className="bg-slate-900 text-slate-50 p-3 rounded-md text-sm font-mono overflow-x-auto">
            <pre>{`import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { canCreate, canUpdate } = usePermissions();
  
  return (
    <>
      {canCreate('crm') && <Button>Ajouter client</Button>}
      {canUpdate('projects') && <Button>Modifier</Button>}
    </>
  );
}`}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            2. Utiliser le composant ProtectedAction
          </h4>
          <div className="bg-slate-900 text-slate-50 p-3 rounded-md text-sm font-mono overflow-x-auto">
            <pre>{`import { ProtectedAction } from '@/components/ProtectedAction';

<ProtectedAction module="crm" action="create">
  <Button>Ajouter un client</Button>
</ProtectedAction>

<ProtectedAction 
  module="projects" 
  action="delete"
  fallback={<p>Vous n'avez pas accès</p>}
>
  <Button variant="destructive">Supprimer</Button>
</ProtectedAction>`}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            3. Modules et actions disponibles
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Modules :</p>
              <ul className="list-disc list-inside text-blue-700 dark:text-blue-300">
                <li>dashboard</li>
                <li>crm</li>
                <li>agencies</li>
                <li>projects</li>
                <li>tasks</li>
                <li>settings</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Actions :</p>
              <ul className="list-disc list-inside text-blue-700 dark:text-blue-300">
                <li>read (lecture)</li>
                <li>create (création)</li>
                <li>update (modification)</li>
                <li>delete (suppression)</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
