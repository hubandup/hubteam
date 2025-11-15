// Temporary fix - will copy to correct location
// Changes:
// 1. Show message only when !client?.kdrive_folder_id
// 2. Add breadcrumbs when folder is connected

// Line 456-469 should be replaced with:
      {!client?.kdrive_folder_id && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm flex items-center justify-between gap-2">
          <span className="text-muted-foreground">
            Le drive kDrive n'est pas attribué pour ce dossier.
          </span>
          {isAdmin && (
            <KDriveFolderSelector
              clientId={clientId}
              clientName={client?.company || 'Client'}
              onFolderConnected={loadClientFolder}
            />
          )}
        </div>
      )}

      {client?.kdrive_folder_id && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto pb-2">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1">
              <button
                onClick={() => handleBreadcrumbClick(crumb)}
                className="hover:text-foreground transition-colors whitespace-nowrap"
              >
                {crumb.name}
              </button>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          ))}
        </div>
      )}