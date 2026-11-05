// the integration-admin namespace. spanish is the default language, english the second.
// plurals carry _many too: spanish uses it for large round numbers, english keeps the same keys
const es = {
  nav: { connectors: 'Versiones de conectores', usage: 'Uso', system: 'Estado del sistema', retention: 'Retención' },
  capability: {
    AUTHENTICATION: 'Autenticación',
    DISCOVERY: 'Descubrimiento',
    READ: 'Lectura',
    CHANGE_FEED: 'Cambios',
    WRITE: 'Escritura',
    UPSERT: 'Crear o actualizar',
    WEBHOOKS: 'Webhooks',
    ACTIONS: 'Acciones'
  },
  maturity: { TESTED: 'Probado', IMPLEMENTED: 'Implementado', DECLARED: 'Declarado' },
  maturityHint: {
    TESTED: 'Implementado y probado contra un proveedor simulado',
    IMPLEMENTED: 'Implementado, sin pruebas de contrato todavía',
    DECLARED: 'Anunciado en el manifiesto, todavía no implementado'
  },
  authType: {
    OAUTH2_AUTHORIZATION_CODE: 'OAuth (inicio de sesión en el proveedor)',
    OAUTH2_CLIENT_CREDENTIALS: 'OAuth (credenciales de cliente)',
    API_KEY: 'Clave de API',
    BASIC: 'Usuario y contraseña'
  },
  connectionStatus: { ACTIVE: 'Activa', NEEDS_REAUTH: 'Requiere reautorizar', ERROR: 'Con error', DISABLED: 'Desactivada' },
  health: { UNKNOWN: 'Sin comprobar', HEALTHY: 'Sana', DEGRADED: 'Degradada', FAILING: 'Fallando' },
  jobStatus: { PENDING: 'Pendientes', RUNNING: 'En curso', SUCCEEDED: 'Terminados', DEAD: 'Agotados' },
  metric: {
    provider_calls: 'Llamadas a proveedores',
    sync_records: 'Registros sincronizados',
    workflow_steps: 'Pasos de flujos',
    ai_tool_calls: 'Llamadas a herramientas de IA'
  },
  connectors: {
    title: 'Versiones de conectores',
    subtitle: 'Los conectores instalados en este servidor: su versión, la del SDK y la madurez de cada capacidad',
    empty: 'No hay conectores instalados',
    emptyHint: 'Un conector se instala en el servidor, como una dependencia integrations-connector-*.',
    summary_one: '{{count}} conector instalado',
    summary_other: '{{count}} conectores instalados',
    summary_many: '{{count}} conectores instalados',
    sdks_one: 'SDK {{versions}}',
    sdks_other: 'SDK en uso: {{versions}}',
    sdks_many: 'SDK en uso: {{versions}}',
    maturityLegend: 'Probado: con pruebas de contrato. Implementado: funciona, sin esas pruebas. Declarado: anunciado, todavía no disponible.',
    connector: 'Conector',
    version: 'Versión',
    sdkVersion: 'SDK',
    auth: 'Autenticación',
    capabilities: 'Capacidades',
    capabilitiesOf: 'Capacidades de {{provider}}',
    appConfigured: 'App OAuth registrada',
    appMissing: 'Falta la app OAuth'
  },
  usage: {
    title: 'Uso',
    subtitle: 'Lo que tu organización consumió, por día y métrica',
    from: 'Desde',
    to: 'Hasta',
    last30: 'Últimos 30 días',
    problem: {
      invalid: 'Indica dos fechas válidas.',
      order: '«Desde» no puede ser posterior a «Hasta».',
      tooLong: 'El rango puede abarcar 366 días como máximo.'
    },
    metric: 'Métrica',
    allMetrics: 'Todas',
    utc: 'Días en UTC. Los contadores se escriben cada 30 segundos: el día de hoy puede ir un poco atrasado.',
    empty: 'Nada contado en este rango',
    emptyHint: 'Un día sin actividad no tiene contadores.',
    totals: 'Totales del rango',
    perDay: 'Por día',
    day: 'Día',
    total: 'Total',
    bar: 'Gráfico'
  },
  system: {
    title: 'Estado del sistema',
    subtitle: 'Conexiones, trabajos en segundo plano, pausas por límite de peticiones y eventos fallidos',
    degraded_one: '{{count}} conexión necesita atención.',
    degraded_other: '{{count}} conexiones necesitan atención.',
    degraded_many: '{{count}} conexiones necesitan atención.',
    dead_one: '{{count}} trabajo agotó sus intentos.',
    dead_other: '{{count}} trabajos agotaron sus intentos.',
    dead_many: '{{count}} trabajos agotaron sus intentos.',
    allGood: 'Todo funciona: ninguna conexión falla y ningún trabajo está agotado.',
    connections: 'Conexiones',
    jobs: 'Trabajos',
    jobsHint: 'Se cuentan los trabajos que aún se conservan: los terminados y agotados se purgan pasados 30 días por defecto.',
    paused: 'Pausas por límite de peticiones',
    noPaused: 'Ninguna conexión en pausa.',
    pausedUntil: 'en pausa hasta',
    pausedHint:
      'Un proveedor que responde 429 pausa la conexión hasta su Retry-After. Solo se ven las pausas de las conexiones que fallan, ' +
      'y las de la réplica que respondió.',
    failing: 'Conexiones con problemas',
    noFailing: 'Ninguna conexión necesita atención',
    connection: 'Conexión',
    status: 'Estado',
    health: 'Salud',
    lastError: 'Último error',
    lastValidated: 'Comprobada'
  },
  jobs: {
    title: 'Trabajos',
    managersOnly: 'La lista de trabajos y sus reintentos son solo para administradores.',
    statusFilter: 'Estado del trabajo',
    all: 'Todos',
    kind: 'Tipo',
    apply: 'Filtrar',
    noDead: 'Ningún trabajo agotado',
    empty: 'Ningún trabajo coincide',
    status: 'Estado',
    attempts: 'Intentos',
    nextAttempt: 'siguiente',
    lastError: 'Último error',
    permanent: 'Error permanente: volverá a fallar si no se corrige la causa.',
    updated: 'Actualizado',
    retry: 'Reintentar',
    retryNamed: 'Reintentar {{kind}}',
    retried: '{{kind}} vuelve a la cola.',
    limited_one: 'Se muestra {{count}} trabajo, el más reciente.',
    limited_other: 'Se muestran los {{count}} más recientes.',
    limited_many: 'Se muestran los {{count}} más recientes.',
    more_one: 'Mostrar {{count}}',
    more_other: 'Mostrar {{count}}',
    more_many: 'Mostrar {{count}}'
  },
  events: {
    title: 'Eventos fallidos',
    none: 'Ningún evento fallido',
    type: 'Evento',
    error: 'Error',
    received: 'Recibido',
    replay: 'Reprocesar',
    replayNamed: 'Reprocesar {{type}}',
    replayed: '{{type}} vuelve a procesarse.',
    more: 'Cargar más'
  },
  retention: {
    title: 'Retención',
    subtitle: 'Cuánto tiempo se conserva el historial terminado antes de purgarlo',
    readOnly:
      'Solo lectura: la retención se configura en el servidor (propiedades wasichai.integrations.retention.*) y ninguna API la expone. ' +
      'Estos son los valores por defecto; tu servidor puede haberlos cambiado.',
    tasks: 'Qué se purga',
    taskName: 'Tarea',
    default: 'Por defecto',
    deleted: 'Se borra',
    kept: 'Nunca se borra',
    days_one: '{{count}} día',
    days_other: '{{count}} días',
    days_many: '{{count}} días',
    module: { integrations: 'Integraciones', sync: 'Sincronización', workflows: 'Flujos', ai: 'IA' },
    task: {
      events: { deleted: 'Eventos procesados, ignorados y fallidos, por fecha de recepción', kept: 'Eventos aún sin procesar' },
      jobs: { deleted: 'Trabajos terminados y agotados, por fecha de fin', kept: 'Trabajos pendientes y en curso' },
      usage: { deleted: 'Contadores diarios de uso, por día', kept: '—' },
      syncRuns: {
        deleted: 'Ejecuciones de sincronización terminadas, por fecha de fin',
        kept: 'La última de cada definición y disparador, y su última exitosa'
      },
      syncConflicts: { deleted: 'Conflictos resueltos, por fecha de resolución', kept: 'Conflictos abiertos; vínculos e instantáneas' },
      workflowExecutions: { deleted: 'Ejecuciones de flujos terminadas, con sus pasos', kept: 'Ejecuciones en curso o esperando aprobación' },
      aiExecutions: { deleted: 'Ejecuciones de herramientas de IA terminadas o rechazadas', kept: 'Aprobaciones pendientes y ejecuciones en curso' }
    },
    override: 'Cada tarea se cambia con {{property}}; 0 la conserva para siempre.',
    purge: 'La purga',
    property: 'Propiedad',
    meaning: 'Qué hace',
    setting: {
      enabled: 'false detiene la purga en una réplica',
      interval: 'cada cuánto se purga, en una sola réplica a la vez',
      'initial-delay': 'espera tras el arranque antes de la primera purga',
      'batch-size': 'filas por sentencia DELETE',
      'max-batches': 'lotes por tarea y pasada; la siguiente continúa'
    },
    beforeAge: 'Reprocesa un evento fallido o reintenta un trabajo agotado antes de que cumpla su edad: después ya no existe.',
    guide: 'Guía de operaciones › Retención',
    newTab: '(se abre en otra pestaña)'
  }
}

const en: typeof es = {
  nav: { connectors: 'Connector versions', usage: 'Usage', system: 'System health', retention: 'Retention' },
  capability: {
    AUTHENTICATION: 'Authentication',
    DISCOVERY: 'Discovery',
    READ: 'Read',
    CHANGE_FEED: 'Change feed',
    WRITE: 'Write',
    UPSERT: 'Upsert',
    WEBHOOKS: 'Webhooks',
    ACTIONS: 'Actions'
  },
  maturity: { TESTED: 'Tested', IMPLEMENTED: 'Implemented', DECLARED: 'Declared' },
  maturityHint: {
    TESTED: 'Implemented and tested against a provider stub',
    IMPLEMENTED: 'Implemented, no contract tests yet',
    DECLARED: 'Announced in the manifest, not implemented yet'
  },
  authType: {
    OAUTH2_AUTHORIZATION_CODE: 'OAuth (sign in at the provider)',
    OAUTH2_CLIENT_CREDENTIALS: 'OAuth (client credentials)',
    API_KEY: 'API key',
    BASIC: 'Username and password'
  },
  connectionStatus: { ACTIVE: 'Active', NEEDS_REAUTH: 'Needs reauthorization', ERROR: 'Error', DISABLED: 'Disabled' },
  health: { UNKNOWN: 'Not checked', HEALTHY: 'Healthy', DEGRADED: 'Degraded', FAILING: 'Failing' },
  jobStatus: { PENDING: 'Pending', RUNNING: 'Running', SUCCEEDED: 'Succeeded', DEAD: 'Dead' },
  metric: {
    provider_calls: 'Provider calls',
    sync_records: 'Synced records',
    workflow_steps: 'Workflow steps',
    ai_tool_calls: 'AI tool calls'
  },
  connectors: {
    title: 'Connector versions',
    subtitle: 'The connectors installed on this server: their version, the SDK version and how mature each capability is',
    empty: 'No connector is installed',
    emptyHint: 'A connector is installed on the server, as an integrations-connector-* dependency.',
    summary_one: '{{count}} connector installed',
    summary_other: '{{count}} connectors installed',
    summary_many: '{{count}} connectors installed',
    sdks_one: 'SDK {{versions}}',
    sdks_other: 'SDKs in use: {{versions}}',
    sdks_many: 'SDKs in use: {{versions}}',
    maturityLegend: 'Tested: has contract tests. Implemented: works, without those tests. Declared: announced, not available yet.',
    connector: 'Connector',
    version: 'Version',
    sdkVersion: 'SDK',
    auth: 'Authentication',
    capabilities: 'Capabilities',
    capabilitiesOf: 'Capabilities of {{provider}}',
    appConfigured: 'OAuth app registered',
    appMissing: 'OAuth app missing'
  },
  usage: {
    title: 'Usage',
    subtitle: 'What your organization used, per day and metric',
    from: 'From',
    to: 'To',
    last30: 'Last 30 days',
    problem: {
      invalid: 'Enter two valid dates.',
      order: '"From" cannot be after "To".',
      tooLong: 'The range can span 366 days at most.'
    },
    metric: 'Metric',
    allMetrics: 'All',
    utc: 'Days are UTC. Counters are written every 30 seconds: today may lag a little.',
    empty: 'Nothing counted in this range',
    emptyHint: 'A day without activity has no counters.',
    totals: 'Range totals',
    perDay: 'Per day',
    day: 'Day',
    total: 'Total',
    bar: 'Chart'
  },
  system: {
    title: 'System health',
    subtitle: 'Connections, background jobs, rate-limit pauses and failed events',
    degraded_one: '{{count}} connection needs attention.',
    degraded_other: '{{count}} connections need attention.',
    degraded_many: '{{count}} connections need attention.',
    dead_one: '{{count}} job ran out of attempts.',
    dead_other: '{{count}} jobs ran out of attempts.',
    dead_many: '{{count}} jobs ran out of attempts.',
    allGood: 'All good: no connection is failing and no job is dead.',
    connections: 'Connections',
    jobs: 'Jobs',
    jobsHint: 'Counts the jobs still kept: succeeded and dead ones are purged after 30 days by default.',
    paused: 'Rate-limit pauses',
    noPaused: 'No connection is paused.',
    pausedUntil: 'paused until',
    pausedHint:
      'A provider answering 429 pauses the connection until its Retry-After. Only pauses of failing connections show, ' +
      'and only those of the replica that answered.',
    failing: 'Connections with problems',
    noFailing: 'No connection needs attention',
    connection: 'Connection',
    status: 'Status',
    health: 'Health',
    lastError: 'Last error',
    lastValidated: 'Checked'
  },
  jobs: {
    title: 'Jobs',
    managersOnly: 'The job list and retries are for administrators only.',
    statusFilter: 'Job status',
    all: 'All',
    kind: 'Kind',
    apply: 'Filter',
    noDead: 'No dead jobs',
    empty: 'No job matches',
    status: 'Status',
    attempts: 'Attempts',
    nextAttempt: 'next',
    lastError: 'Last error',
    permanent: 'Permanent error: it fails again unless the cause is fixed.',
    updated: 'Updated',
    retry: 'Retry',
    retryNamed: 'Retry {{kind}}',
    retried: '{{kind}} is queued again.',
    limited_one: 'Showing {{count}} job, the most recent.',
    limited_other: 'Showing the {{count}} most recent.',
    limited_many: 'Showing the {{count}} most recent.',
    more_one: 'Show {{count}}',
    more_other: 'Show {{count}}',
    more_many: 'Show {{count}}'
  },
  events: {
    title: 'Failed events',
    none: 'No failed events',
    type: 'Event',
    error: 'Error',
    received: 'Received',
    replay: 'Replay',
    replayNamed: 'Replay {{type}}',
    replayed: '{{type}} is processed again.',
    more: 'Load more'
  },
  retention: {
    title: 'Retention',
    subtitle: 'How long finished history is kept before it is purged',
    readOnly:
      'Read only: retention is server configuration (wasichai.integrations.retention.* properties) and no API exposes it. ' +
      'These are the defaults; your server may have changed them.',
    tasks: 'What is purged',
    taskName: 'Task',
    default: 'Default',
    deleted: 'Deleted',
    kept: 'Never deleted',
    days_one: '{{count}} day',
    days_other: '{{count}} days',
    days_many: '{{count}} days',
    module: { integrations: 'Integrations', sync: 'Synchronization', workflows: 'Workflows', ai: 'AI' },
    task: {
      events: { deleted: 'Processed, ignored and failed events, by reception time', kept: 'Events not processed yet' },
      jobs: { deleted: 'Succeeded and dead jobs, by finish time', kept: 'Pending and running jobs' },
      usage: { deleted: 'Daily usage counters, by day', kept: '—' },
      syncRuns: { deleted: 'Finished sync runs, by finish time', kept: 'The latest run of each definition and trigger, and its latest successful run' },
      syncConflicts: { deleted: 'Resolved conflicts, by resolution time', kept: 'Open conflicts; links and snapshots' },
      workflowExecutions: { deleted: 'Finished workflow runs, with their steps', kept: 'Running runs and runs waiting for approval' },
      aiExecutions: { deleted: 'Finished and rejected AI tool executions', kept: 'Pending approvals and running executions' }
    },
    override: 'Each task is changed with {{property}}; 0 keeps it forever.',
    purge: 'The purge',
    property: 'Property',
    meaning: 'What it does',
    setting: {
      enabled: 'false stops the purge on a replica',
      interval: 'how often it purges, on one replica at a time',
      'initial-delay': 'wait after start-up before the first purge',
      'batch-size': 'rows per DELETE statement',
      'max-batches': 'batches per task and run; the next run goes on'
    },
    beforeAge: 'Replay a failed event or retry a dead job before its age passes: after that it is gone.',
    guide: 'Operations guide › Retention',
    newTab: '(opens in a new tab)'
  }
}

export const integrationAdminMessages = { es, en }
