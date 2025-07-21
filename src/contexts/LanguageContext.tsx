import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translation dictionaries
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.agentBuilder': 'Agent Builder',
    'nav.trainingCenter': 'Training Center',
    'nav.channels': 'Channels',
    'nav.conversations': 'Conversations',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    
    // Common
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.upload': 'Upload',
    'common.download': 'Download',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.overview': 'Overview',
    'dashboard.welcome': 'Welcome back',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.createAgent': 'Create New Agent',
    'dashboard.viewAnalytics': 'View Analytics',
    'dashboard.manageChannels': 'Manage Channels',
    'dashboard.totalAgents': 'Total Agents',
    'dashboard.activeConversations': 'Active Conversations',
    'dashboard.totalMessages': 'Total Messages',
    'dashboard.responseTime': 'Avg Response Time',
    'dashboard.satisfaction': 'Customer Satisfaction',
    'dashboard.conversationTrends': 'Conversation Trends',
    'dashboard.channelPerformance': 'Channel Performance',
    'dashboard.recentAgents': 'Recent Agents',
    'dashboard.agentName': 'Agent Name',
    'dashboard.status': 'Status',
    'dashboard.conversations': 'Conversations',
    'dashboard.lastActive': 'Last Active',
    'dashboard.accuracy': 'Accuracy',
    
    // Agent Builder
    'agents.title': 'Agent Builder',
    'agents.createNew': 'Create New Agent',
    'agents.agentName': 'Agent Name',
    'agents.personality': 'Personality',
    'agents.role': 'Role',
    
    'agentBuilder.title': 'Agent Builder',
    'agentBuilder.description': 'Create and manage your custom AI agents for different business roles.',
    'agentBuilder.createAgent': 'Create Agent',
    'agentBuilder.createNewAgent': 'Create New Agent',
    'agentBuilder.agentName': 'Agent Name',
    'agentBuilder.role': 'Role',
    'agentBuilder.status': 'Status',
    'agentBuilder.configure': 'Configure',
    'agentBuilder.test': 'Test',
    'agentBuilder.conversations': 'Conversations',
    'agentBuilder.accuracy': 'Accuracy',
    
    // Training Center
    'training.title': 'Training Center',
    'training.description': 'Upload and manage training data for your AI agents. Documents are processed using RAG technology.',
    'training.uploadData': 'Upload Training Data',
    'training.uploadDocuments': 'Upload Documents',
    'training.totalDocuments': 'Total Documents',
    'training.processed': 'Processed',
    'training.knowledgeChunks': 'Knowledge Chunks',
    'training.vectorized': 'Vectorized',
    'training.knowledgeBase': 'Knowledge Base',
    'training.documents': 'Documents',
    
    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.billing': 'Billing',
    'settings.team': 'Team',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.lightMode': 'Light Mode',
    'settings.darkMode': 'Dark Mode',
  },
  es: {
    // Navigation
    'nav.dashboard': 'Panel de Control',
    'nav.agentBuilder': 'Constructor de Agentes',
    'nav.trainingCenter': 'Centro de Entrenamiento',
    'nav.channels': 'Canales',
    'nav.conversations': 'Conversaciones',
    'nav.analytics': 'Analíticas',
    'nav.settings': 'Configuración',
    
    // Common
    'common.search': 'Buscar...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.upload': 'Subir',
    'common.download': 'Descargar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    
    // Dashboard
    'dashboard.title': 'Panel de Control',
    'dashboard.overview': 'Resumen',
    'dashboard.welcome': 'Bienvenido de nuevo',
    'dashboard.quickActions': 'Acciones Rápidas',
    'dashboard.createAgent': 'Crear Nuevo Agente',
    'dashboard.viewAnalytics': 'Ver Analíticas',
    'dashboard.manageChannels': 'Gestionar Canales',
    'dashboard.totalAgents': 'Agentes Totales',
    'dashboard.activeConversations': 'Conversaciones Activas',
    'dashboard.totalMessages': 'Total de Mensajes',
    'dashboard.responseTime': 'Tiempo de Respuesta Promedio',
    'dashboard.satisfaction': 'Satisfacción del Cliente',
    'dashboard.conversationTrends': 'Tendencias de Conversación',
    'dashboard.channelPerformance': 'Rendimiento de Canales',
    'dashboard.recentAgents': 'Agentes Recientes',
    'dashboard.agentName': 'Nombre del Agente',
    'dashboard.status': 'Estado',
    'dashboard.conversations': 'Conversaciones',
    'dashboard.lastActive': 'Última Actividad',
    'dashboard.accuracy': 'Precisión',
    
    // Agent Builder
    'agents.title': 'Constructor de Agentes',
    'agents.createNew': 'Crear Nuevo Agente',
    'agents.agentName': 'Nombre del Agente',
    'agents.personality': 'Personalidad',
    'agents.role': 'Rol',
    
    'agentBuilder.title': 'Constructor de Agentes',
    'agentBuilder.description': 'Crea y gestiona tus agentes de IA personalizados para diferentes roles empresariales.',
    'agentBuilder.createAgent': 'Crear Agente',
    'agentBuilder.createNewAgent': 'Crear Nuevo Agente',
    'agentBuilder.agentName': 'Nombre del Agente',
    'agentBuilder.role': 'Rol',
    'agentBuilder.status': 'Estado',
    'agentBuilder.configure': 'Configurar',
    'agentBuilder.test': 'Probar',
    'agentBuilder.conversations': 'Conversaciones',
    'agentBuilder.accuracy': 'Precisión',
    
    // Training Center
    'training.title': 'Centro de Entrenamiento',
    'training.description': 'Sube y gestiona datos de entrenamiento para tus agentes de IA. Los documentos se procesan usando tecnología RAG.',
    'training.uploadData': 'Subir Datos de Entrenamiento',
    'training.uploadDocuments': 'Subir Documentos',
    'training.totalDocuments': 'Documentos Totales',
    'training.processed': 'Procesados',
    'training.knowledgeChunks': 'Fragmentos de Conocimiento',
    'training.vectorized': 'Vectorizados',
    'training.knowledgeBase': 'Base de Conocimiento',
    'training.documents': 'Documentos',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.profile': 'Perfil',
    'settings.billing': 'Facturación',
    'settings.team': 'Equipo',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.lightMode': 'Modo Claro',
    'settings.darkMode': 'Modo Oscuro',
  },
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de Bord',
    'nav.agentBuilder': 'Constructeur d\'Agents',
    'nav.trainingCenter': 'Centre de Formation',
    'nav.channels': 'Canaux',
    'nav.conversations': 'Conversations',
    'nav.analytics': 'Analytiques',
    'nav.settings': 'Paramètres',
    
    // Common
    'common.search': 'Rechercher...',
    'common.save': 'Sauvegarder',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.upload': 'Télécharger',
    'common.download': 'Télécharger',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    
    // Dashboard
    'dashboard.title': 'Tableau de Bord',
    'dashboard.overview': 'Aperçu',
    'dashboard.welcome': 'Bon retour',
    'dashboard.quickActions': 'Actions Rapides',
    'dashboard.createAgent': 'Créer un Nouvel Agent',
    'dashboard.viewAnalytics': 'Voir les Analytiques',
    'dashboard.manageChannels': 'Gérer les Canaux',
    'dashboard.totalAgents': 'Agents Totaux',
    'dashboard.activeConversations': 'Conversations Actives',
    'dashboard.totalMessages': 'Total des Messages',
    'dashboard.responseTime': 'Temps de Réponse Moyen',
    'dashboard.satisfaction': 'Satisfaction Client',
    'dashboard.conversationTrends': 'Tendances des Conversations',
    'dashboard.channelPerformance': 'Performance des Canaux',
    'dashboard.recentAgents': 'Agents Récents',
    'dashboard.agentName': 'Nom de l\'Agent',
    'dashboard.status': 'Statut',
    'dashboard.conversations': 'Conversations',
    'dashboard.lastActive': 'Dernière Activité',
    'dashboard.accuracy': 'Précision',
    
    // Agent Builder
    'agents.title': 'Constructeur d\'Agents',
    'agents.createNew': 'Créer un Nouvel Agent',
    'agents.agentName': 'Nom de l\'Agent',
    'agents.personality': 'Personnalité',
    'agents.role': 'Rôle',
    
    'agentBuilder.title': 'Constructeur d\'Agents',
    'agentBuilder.description': 'Créez et gérez vos agents IA personnalisés pour différents rôles d\'entreprise.',
    'agentBuilder.createAgent': 'Créer un Agent',
    'agentBuilder.createNewAgent': 'Créer un Nouvel Agent',
    'agentBuilder.agentName': 'Nom de l\'Agent',
    'agentBuilder.role': 'Rôle',
    'agentBuilder.status': 'Statut',
    'agentBuilder.configure': 'Configurer',
    'agentBuilder.test': 'Tester',
    'agentBuilder.conversations': 'Conversations',
    'agentBuilder.accuracy': 'Précision',
    
    // Training Center
    'training.title': 'Centre de Formation',
    'training.description': 'Téléchargez et gérez les données d\'entraînement pour vos agents IA. Les documents sont traités avec la technologie RAG.',
    'training.uploadData': 'Télécharger les Données de Formation',
    'training.uploadDocuments': 'Télécharger des Documents',
    'training.totalDocuments': 'Documents Totaux',
    'training.processed': 'Traités',
    'training.knowledgeChunks': 'Fragments de Connaissance',
    'training.vectorized': 'Vectorisés',
    'training.knowledgeBase': 'Base de Connaissances',
    'training.documents': 'Documents',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.profile': 'Profil',
    'settings.billing': 'Facturation',
    'settings.team': 'Équipe',
    'settings.language': 'Langue',
    'settings.theme': 'Thème',
    'settings.lightMode': 'Mode Clair',
    'settings.darkMode': 'Mode Sombre',
  },
  de: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.agentBuilder': 'Agent Builder',
    'nav.trainingCenter': 'Trainingszentrum',
    'nav.channels': 'Kanäle',
    'nav.conversations': 'Gespräche',
    'nav.analytics': 'Analytik',
    'nav.settings': 'Einstellungen',
    
    // Common
    'common.search': 'Suchen...',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.create': 'Erstellen',
    'common.upload': 'Hochladen',
    'common.download': 'Herunterladen',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.overview': 'Übersicht',
    'dashboard.welcome': 'Willkommen zurück',
    'dashboard.quickActions': 'Schnellaktionen',
    'dashboard.createAgent': 'Neuen Agent Erstellen',
    'dashboard.viewAnalytics': 'Analytik Anzeigen',
    'dashboard.manageChannels': 'Kanäle Verwalten',
    'dashboard.totalAgents': 'Gesamte Agenten',
    'dashboard.activeConversations': 'Aktive Gespräche',
    'dashboard.totalMessages': 'Gesamte Nachrichten',
    'dashboard.responseTime': 'Durchschnittliche Antwortzeit',
    'dashboard.satisfaction': 'Kundenzufriedenheit',
    'dashboard.conversationTrends': 'Gesprächstrends',
    'dashboard.channelPerformance': 'Kanal-Performance',
    'dashboard.recentAgents': 'Neueste Agenten',
    'dashboard.agentName': 'Agent Name',
    'dashboard.status': 'Status',
    'dashboard.conversations': 'Gespräche',
    'dashboard.lastActive': 'Zuletzt Aktiv',
    'dashboard.accuracy': 'Genauigkeit',
    
    // Agent Builder
    'agents.title': 'Agent Builder',
    'agents.createNew': 'Neuen Agent Erstellen',
    'agents.agentName': 'Agent Name',
    'agents.personality': 'Persönlichkeit',
    'agents.role': 'Rolle',
    
    'agentBuilder.title': 'Agent Builder',
    'agentBuilder.description': 'Erstellen und verwalten Sie Ihre benutzerdefinierten KI-Agenten für verschiedene Geschäftsrollen.',
    'agentBuilder.createAgent': 'Agent Erstellen',
    'agentBuilder.createNewAgent': 'Neuen Agent Erstellen',
    'agentBuilder.agentName': 'Agent Name',
    'agentBuilder.role': 'Rolle',
    'agentBuilder.status': 'Status',
    'agentBuilder.configure': 'Konfigurieren',
    'agentBuilder.test': 'Testen',
    'agentBuilder.conversations': 'Gespräche',
    'agentBuilder.accuracy': 'Genauigkeit',
    
    // Training Center
    'training.title': 'Trainingszentrum',
    'training.description': 'Laden Sie Trainingsdaten für Ihre KI-Agenten hoch und verwalten Sie sie. Dokumente werden mit RAG-Technologie verarbeitet.',
    'training.uploadData': 'Trainingsdaten Hochladen',
    'training.uploadDocuments': 'Dokumente Hochladen',
    'training.totalDocuments': 'Gesamte Dokumente',
    'training.processed': 'Verarbeitet',
    'training.knowledgeChunks': 'Wissensblöcke',
    'training.vectorized': 'Vektorisiert',
    'training.knowledgeBase': 'Wissensbasis',
    'training.documents': 'Dokumente',
    
    // Settings
    'settings.title': 'Einstellungen',
    'settings.profile': 'Profil',
    'settings.billing': 'Abrechnung',
    'settings.team': 'Team',
    'settings.language': 'Sprache',
    'settings.theme': 'Thema',
    'settings.lightMode': 'Heller Modus',
    'settings.darkMode': 'Dunkler Modus',
  },
  zh: {
    // Navigation
    'nav.dashboard': '仪表板',
    'nav.agentBuilder': '智能体构建器',
    'nav.trainingCenter': '训练中心',
    'nav.channels': '渠道',
    'nav.conversations': '对话',
    'nav.analytics': '分析',
    'nav.settings': '设置',
    
    // Common
    'common.search': '搜索...',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.create': '创建',
    'common.upload': '上传',
    'common.download': '下载',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    
    // Dashboard
    'dashboard.title': '仪表板',
    'dashboard.overview': '概览',
    'dashboard.welcome': '欢迎回来',
    'dashboard.quickActions': '快速操作',
    'dashboard.createAgent': '创建新智能体',
    'dashboard.viewAnalytics': '查看分析',
    'dashboard.manageChannels': '管理渠道',
    'dashboard.totalAgents': '智能体总数',
    'dashboard.activeConversations': '活跃对话',
    'dashboard.totalMessages': '消息总数',
    'dashboard.responseTime': '平均响应时间',
    'dashboard.satisfaction': '客户满意度',
    'dashboard.conversationTrends': '对话趋势',
    'dashboard.channelPerformance': '渠道表现',
    'dashboard.recentAgents': '最近的智能体',
    'dashboard.agentName': '智能体名称',
    'dashboard.status': '状态',
    'dashboard.conversations': '对话',
    'dashboard.lastActive': '最后活跃',
    'dashboard.accuracy': '准确率',
    
    // Agent Builder
    'agents.title': '智能体构建器',
    'agents.createNew': '创建新智能体',
    'agents.agentName': '智能体名称',
    'agents.personality': '个性',
    'agents.role': '角色',
    
    'agentBuilder.title': '智能体构建器',
    'agentBuilder.description': '为不同的业务角色创建和管理您的自定义AI智能体。',
    'agentBuilder.createAgent': '创建智能体',
    'agentBuilder.createNewAgent': '创建新智能体',
    'agentBuilder.agentName': '智能体名称',
    'agentBuilder.role': '角色',
    'agentBuilder.status': '状态',
    'agentBuilder.configure': '配置',
    'agentBuilder.test': '测试',
    'agentBuilder.conversations': '对话',
    'agentBuilder.accuracy': '准确率',
    
    // Training Center
    'training.title': '训练中心',
    'training.description': '为您的AI智能体上传和管理训练数据。文档使用RAG技术进行处理。',
    'training.uploadData': '上传训练数据',
    'training.uploadDocuments': '上传文档',
    'training.totalDocuments': '文档总数',
    'training.processed': '已处理',
    'training.knowledgeChunks': '知识块',
    'training.vectorized': '已向量化',
    'training.knowledgeBase': '知识库',
    'training.documents': '文档',
    
    // Settings
    'settings.title': '设置',
    'settings.profile': '个人资料',
    'settings.billing': '账单',
    'settings.team': '团队',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.lightMode': '浅色模式',
    'settings.darkMode': '深色模式',
  },
  ar: {
    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.agentBuilder': 'منشئ الوكلاء',
    'nav.trainingCenter': 'مركز التدريب',
    'nav.channels': 'القنوات',
    'nav.conversations': 'المحادثات',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    
    // Common
    'common.search': 'بحث...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تحرير',
    'common.create': 'إنشاء',
    'common.upload': 'رفع',
    'common.download': 'تحميل',
    'common.loading': 'جاري التحميل...',
    'common.error': 'خطأ',
    'common.success': 'نجح',
    
    // Dashboard
    'dashboard.title': 'لوحة التحكم',
    'dashboard.overview': 'نظرة عامة',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.quickActions': 'الإجراءات السريعة',
    'dashboard.createAgent': 'إنشاء وكيل جديد',
    'dashboard.viewAnalytics': 'عرض التحليلات',
    'dashboard.manageChannels': 'إدارة القنوات',
    'dashboard.totalAgents': 'إجمالي الوكلاء',
    'dashboard.activeConversations': 'المحادثات النشطة',
    'dashboard.totalMessages': 'إجمالي الرسائل',
    'dashboard.responseTime': 'متوسط وقت الاستجابة',
    'dashboard.satisfaction': 'رضا العملاء',
    'dashboard.conversationTrends': 'اتجاهات المحادثة',
    'dashboard.channelPerformance': 'أداء القنوات',
    'dashboard.recentAgents': 'الوكلاء الحديثون',
    'dashboard.agentName': 'اسم الوكيل',
    'dashboard.status': 'الحالة',
    'dashboard.conversations': 'المحادثات',
    'dashboard.lastActive': 'آخر نشاط',
    'dashboard.accuracy': 'الدقة',
    
    // Agent Builder
    'agents.title': 'منشئ الوكلاء',
    'agents.createNew': 'إنشاء وكيل جديد',
    'agents.agentName': 'اسم الوكيل',
    'agents.personality': 'الشخصية',
    'agents.role': 'الدور',
    
    'agentBuilder.title': 'منشئ الوكلاء',
    'agentBuilder.description': 'إنشاء وإدارة وكلاء الذكاء الاصطناعي المخصصين لأدوار الأعمال المختلفة.',
    'agentBuilder.createAgent': 'إنشاء وكيل',
    'agentBuilder.createNewAgent': 'إنشاء وكيل جديد',
    'agentBuilder.agentName': 'اسم الوكيل',
    'agentBuilder.role': 'الدور',
    'agentBuilder.status': 'الحالة',
    'agentBuilder.configure': 'تكوين',
    'agentBuilder.test': 'اختبار',
    'agentBuilder.conversations': 'المحادثات',
    'agentBuilder.accuracy': 'الدقة',
    
    // Training Center
    'training.title': 'مركز التدريب',
    'training.description': 'ارفع وأدر بيانات التدريب لوكلاء الذكاء الاصطناعي. تتم معالجة المستندات باستخدام تقنية RAG.',
    'training.uploadData': 'رفع بيانات التدريب',
    'training.uploadDocuments': 'رفع المستندات',
    'training.totalDocuments': 'إجمالي المستندات',
    'training.processed': 'معالج',
    'training.knowledgeChunks': 'أجزاء المعرفة',
    'training.vectorized': 'متجه',
    'training.knowledgeBase': 'قاعدة المعرفة',
    'training.documents': 'المستندات',
    
    // Settings
    'settings.title': 'الإعدادات',
    'settings.profile': 'الملف الشخصي',
    'settings.billing': 'الفواتير',
    'settings.team': 'الفريق',
    'settings.language': 'اللغة',
    'settings.theme': 'المظهر',
    'settings.lightMode': 'الوضع الفاتح',
    'settings.darkMode': 'الوضع الداكن',
  },
}

interface LanguageProviderProps {
  children: React.ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && Object.keys(translations).includes(savedLanguage)) {
      return savedLanguage
    }
    // Detect browser language
    const browserLang = navigator.language.split('-')[0] as Language
    return Object.keys(translations).includes(browserLang) ? browserLang : 'en'
  })

  useEffect(() => {
    localStorage.setItem('language', language)
    // Set document direction for RTL languages
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  const value = {
    language,
    setLanguage,
    t,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
] as const