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
  const params = new URLSearchParams(location.search);
  const currentTab = params.get('tab');

  // Route name and path mapping
  const routeConfig: Record<string, { name: string; path?: string }> = {
    crm: { name: 'CRM', path: '/crm' },
    client: { name: 'Client', path: '/crm' }, // Client pages should link back to CRM
    agencies: { name: 'Agences', path: '/agencies' },
    agency: { name: 'Agence', path: '/agencies' },
    projects: { name: 'Projets', path: '/projects' },
    project: { name: 'Projet', path: '/projects' },
    tasks: { name: 'Tâches', path: '/tasks' },
    settings: { name: 'Paramètres', path: '/settings' },
    messages: { name: 'Messages', path: '/messages' },
    activity: { name: 'Activité', path: '/activity' },
    faq: { name: 'FAQ', path: '/faq' },
  };

  const tabNames: Record<string, string> = {
    'info': 'Infos',
    'meeting-notes': 'Comptes rendus',
    'projects': 'Projets',
    'invoices': 'Factures',
    'tasks': 'Tâches',
  };

  // Don't show breadcrumbs on home page or auth page
  if (pathnames.length === 0 || pathnames[0] === 'auth') {
    return null;
  }

  const isClientPage = pathnames.includes('client');

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

        {/* Inject CRM level if on a client page */}
        {isClientPage && (
          <div className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/crm">CRM</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </div>
        )}

        {pathnames.map((segment, index) => {
          const config = routeConfig[segment];
          const routeTo = config?.path || `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = config?.name || segment;

          // Skip displaying UUIDs in breadcrumbs
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
          if (isUUID) {
            return null;
          }

          return (
            <div key={`${routeTo}-${index}`} className="flex items-center gap-2">
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

        {/* Append tab name for pages using tabs */}
        {currentTab && tabNames[currentTab] && (
          <div className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{tabNames[currentTab]}</BreadcrumbPage>
            </BreadcrumbItem>
          </div>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

