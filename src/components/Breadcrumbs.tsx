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
import { useTranslation } from 'react-i18next';

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const params = new URLSearchParams(location.search);
  const currentTab = params.get('tab');
  const { t } = useTranslation();

  const routeConfig: Record<string, { nameKey: string; path?: string }> = {
    crm: { nameKey: 'breadcrumbs.crm', path: '/crm' },
    client: { nameKey: 'breadcrumbs.client', path: '/crm' },
    agencies: { nameKey: 'breadcrumbs.agencies', path: '/agencies' },
    agency: { nameKey: 'breadcrumbs.agency', path: '/agencies' },
    projects: { nameKey: 'breadcrumbs.projects', path: '/projects' },
    project: { nameKey: 'breadcrumbs.project', path: '/projects' },
    tasks: { nameKey: 'breadcrumbs.tasks', path: '/tasks' },
    settings: { nameKey: 'breadcrumbs.settings', path: '/settings' },
    messages: { nameKey: 'breadcrumbs.messages', path: '/messages' },
    activity: { nameKey: 'breadcrumbs.activity', path: '/activity' },
    faq: { nameKey: 'breadcrumbs.faq', path: '/faq' },
  };

  const tabNames: Record<string, string> = {
    'info': t('breadcrumbs.tabs.info'),
    'meeting-notes': t('breadcrumbs.tabs.meetingNotes'),
    'projects': t('breadcrumbs.tabs.projects'),
    'invoices': t('breadcrumbs.tabs.invoices'),
    'tasks': t('breadcrumbs.tabs.tasks'),
    'team': t('breadcrumbs.tabs.team'),
    'comments': t('breadcrumbs.tabs.comments'),
    'attachments': t('breadcrumbs.tabs.attachments'),
  };

  if (pathnames.length === 0 || pathnames[0] === 'auth') {
    return null;
  }

  const isClientPage = pathnames.includes('client');
  const isProjectPage = pathnames.includes('project');
  const isAgencyPage = pathnames.includes('agency');

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              {t('breadcrumbs.home')}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {isClientPage && (
          <div className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/crm">{t('breadcrumbs.crm')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </div>
        )}

        {isProjectPage && (
          <div className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects">{t('breadcrumbs.projects')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </div>
        )}

        {isAgencyPage && (
          <div className="flex items-center gap-2">
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/agencies">{t('breadcrumbs.agencies')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </div>
        )}

        {pathnames.map((segment, index) => {
          const config = routeConfig[segment];
          const routeTo = config?.path || `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = config ? t(config.nameKey) : segment;

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
