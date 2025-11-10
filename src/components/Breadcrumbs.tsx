import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Route name mapping
  const routeNames: Record<string, string> = {
    crm: 'CRM',
    client: 'Client',
    agencies: 'Agences',
    agency: 'Agence',
    projects: 'Projets',
    project: 'Projet',
    tasks: 'Tâches',
    settings: 'Paramètres',
  };

  // Don't show breadcrumbs on home page or auth page
  if (pathnames.length === 0 || pathnames[0] === 'auth') {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Tableau de bord
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathnames.map((segment, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = routeNames[segment] || segment;

          // Skip displaying UUIDs in breadcrumbs
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
          if (isUUID) {
            return null;
          }

          return (
            <div key={routeTo} className="flex items-center gap-2">
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayName}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={routeTo}>{displayName}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
