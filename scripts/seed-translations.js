import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// All translations from the codebase
const translations = {
  en: {
    meta: {
      title: 'BoyVue Gallery - Free Nude Boys Photos & Gay Videos',
      description: 'Browse 350,000+ free nude boy photos and gay videos. HD quality twinks, young men, amateur content. Updated daily.',
      keywords: 'nude boys, naked twinks, gay photos, gay videos, male nude, teen boys nude, young men naked, gay gallery, twink pics, free gay porn'
    },
    ui: {
      allImages: 'All Images', categories: 'Categories', search: 'Search', searchPlaceholder: 'Search nude boys, twinks...', loading: 'Loading...',
      prev: 'Prev', next: 'Next', page: 'Page', of: 'of', views: 'views', rating: 'rating', images: 'images', comments: 'comments', users: 'users',
      videos: 'videos', backToGallery: 'Back to Gallery', home: 'Home', relatedIn: 'Related in', tags: 'Tags', postComment: 'Post Comment',
      yourName: 'Your name', writeComment: 'Write a comment...', noComments: 'No comments yet.', clearSearch: 'Clear', video: 'VIDEO', untitled: 'Untitled',
      privacy: 'Privacy', terms: 'Terms', dmca: 'DMCA', contact: 'Contact', compliance: '18 U.S.C. 2257',
      allModels: 'All models were 18+ at the time of depiction.', rtaLabel: 'RTA labeled site.', allRights: 'All Rights Reserved',
      legalCompliance: 'Legal Compliance', statementTitle: '18 U.S.C. § 2257 Statement',
      statementText: 'All persons depicted were 18+ years old at the time of creation.',
      ageVerification: 'Age Verification', ageVerificationText: 'You must be 18+ to enter.',
      contentRemoval: 'Content Removal (DMCA)', privacyPolicy: 'Privacy Policy', termsOfService: 'Terms of Service',
      rtaLabelTitle: 'RTA Label', lastUpdated: 'Last updated', online: 'online', share: 'Share', copyLink: 'Copy Link', linkCopied: 'Link copied!'
    },
    agegate: {
      title: 'Age Verification Required', warning: 'This website contains adult content',
      question: 'Are you 18 years or older?', yes: 'Yes, I am 18+', no: 'No, Exit',
      disclaimer: 'By entering, you confirm you are at least 18 years old.'
    },
    seo: {
      defaultTitle: 'BoyVue Gallery - Free Gay Photo & Video Gallery',
      defaultDescription: 'Browse 356,000+ free gay photos and 5,500+ videos.'
    },
    stats: {
      liveStats: 'Live Statistics', onlineNow: 'Online Now', today: 'Today',
      pageViews: 'Views', countries: 'Countries', referrers: 'Referrers'
    }
  },
  de: {
    meta: {
      title: 'BoyVue Galerie - Kostenlose Nackte Jungs Fotos & Gay Videos',
      description: 'Durchsuchen Sie 350.000+ kostenlose nackte Jungs Fotos und Gay Videos. HD-Qualität Twinks, junge Männer. Täglich aktualisiert.',
      keywords: 'nackte jungs, schwule fotos, gay videos, twink bilder, männer nackt, junge männer nackt, gay galerie, kostenlose gay fotos'
    },
    ui: {
      allImages: 'Alle Bilder', categories: 'Kategorien', search: 'Suchen', searchPlaceholder: 'Nackte Jungs suchen...', loading: 'Laden...',
      prev: 'Zurück', next: 'Weiter', page: 'Seite', of: 'von', views: 'Aufrufe', rating: 'Bewertung', images: 'Bilder', comments: 'Kommentare', users: 'Benutzer',
      videos: 'Videos', backToGallery: 'Zurück', home: 'Start', relatedIn: 'Ähnlich in', tags: 'Tags', postComment: 'Kommentieren',
      yourName: 'Name', writeComment: 'Kommentar...', noComments: 'Keine Kommentare.', clearSearch: 'Löschen', video: 'VIDEO', untitled: 'Ohne Titel',
      privacy: 'Datenschutz', terms: 'AGB', dmca: 'DMCA', contact: 'Kontakt', compliance: '18 U.S.C. 2257',
      allModels: 'Alle Models waren 18+ Jahre alt.', rtaLabel: 'RTA gekennzeichnet.', allRights: 'Alle Rechte vorbehalten',
      legalCompliance: 'Rechtliches', statementTitle: '18 U.S.C. § 2257', statementText: 'Alle dargestellten Personen waren 18+ Jahre alt.',
      ageVerification: 'Altersverifikation', ageVerificationText: 'Sie müssen 18+ sein.', contentRemoval: 'DMCA', privacyPolicy: 'Datenschutz', termsOfService: 'AGB',
      rtaLabelTitle: 'RTA', lastUpdated: 'Aktualisiert', online: 'online', share: 'Teilen', copyLink: 'Link kopieren', linkCopied: 'Link kopiert!'
    },
    agegate: {
      title: 'Altersverifikation', warning: 'Erwachseneninhalte',
      question: 'Sind Sie 18+?', yes: 'Ja', no: 'Nein',
      disclaimer: 'Mit Eintritt bestätigen Sie 18+ zu sein.'
    },
    seo: {
      defaultTitle: 'BoyVue Galerie - Kostenlose Gay Foto & Video Galerie',
      defaultDescription: 'Durchsuche 356.000+ kostenlose Gay Fotos und 5.500+ Videos.'
    },
    stats: {
      liveStats: 'Live-Statistiken', onlineNow: 'Jetzt online', today: 'Heute',
      pageViews: 'Aufrufe', countries: 'Länder', referrers: 'Verweise'
    }
  },
  ru: {
    meta: {
      title: 'BoyVue Галерея - Бесплатные Голые Парни Фото и Гей Видео',
      description: 'Смотрите 350,000+ бесплатных голые парни фото и гей видео. HD качество твинки, молодые мужчины. Обновляется ежедневно.',
      keywords: 'голые парни, гей фото, гей видео, твинки фото, мужчины голые, молодые парни голые, гей галерея, бесплатные гей фото'
    },
    ui: {
      allImages: 'Все', categories: 'Категории', search: 'Поиск', searchPlaceholder: 'Поиск парней...', loading: 'Загрузка...',
      prev: 'Назад', next: 'Далее', page: 'Стр', of: 'из', views: 'просм', rating: 'рейт', images: 'фото', comments: 'комм', users: 'польз',
      videos: 'видео', backToGallery: 'Назад', home: 'Главная', relatedIn: 'Похожие', tags: 'Теги', postComment: 'Отправить',
      yourName: 'Имя', writeComment: 'Комментарий...', noComments: 'Нет комментариев.', clearSearch: 'Очистить', video: 'ВИДЕО', untitled: 'Без названия',
      privacy: 'Конфиденциальность', terms: 'Условия', dmca: 'DMCA', contact: 'Контакты', compliance: '18 U.S.C. 2257',
      allModels: 'Всем моделям было 18+ лет.', rtaLabel: 'RTA метка.', allRights: 'Все права защищены',
      legalCompliance: 'Правовая информация', statementTitle: '18 U.S.C. § 2257', statementText: 'Всем изображенным было 18+ лет.',
      ageVerification: 'Проверка возраста', ageVerificationText: 'Вам должно быть 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Конфиденциальность', termsOfService: 'Условия',
      rtaLabelTitle: 'RTA', lastUpdated: 'Обновлено', online: 'онлайн', share: 'Поделиться', copyLink: 'Копировать ссылку', linkCopied: 'Ссылка скопирована!'
    },
    agegate: {
      title: 'Проверка возраста', warning: 'Контент для взрослых',
      question: 'Вам 18+?', yes: 'Да', no: 'Нет',
      disclaimer: 'Входя, вы подтверждаете что вам 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Галерея - Бесплатная Gay Галерея',
      defaultDescription: 'Просмотрите 356 000+ фото и видео.'
    },
    stats: {
      liveStats: 'Статистика', onlineNow: 'Сейчас онлайн', today: 'Сегодня',
      pageViews: 'Просмотры', countries: 'Страны', referrers: 'Источники'
    }
  },
  es: {
    meta: {
      title: 'BoyVue Galería - Fotos Chicos Desnudos y Videos Gay Gratis',
      description: 'Explora 350,000+ fotos chicos desnudos y videos gay gratis. Calidad HD twinks, jóvenes. Actualizado diariamente.',
      keywords: 'chicos desnudos, fotos gay, videos gay, twink fotos, hombres desnudos, jóvenes desnudos, galería gay, fotos gay gratis'
    },
    ui: {
      allImages: 'Todas', categories: 'Categorías', search: 'Buscar', searchPlaceholder: 'Buscar chicos...', loading: 'Cargando...',
      prev: 'Anterior', next: 'Siguiente', page: 'Página', of: 'de', views: 'vistas', rating: 'nota', images: 'fotos', comments: 'comentarios', users: 'usuarios',
      videos: 'videos', backToGallery: 'Volver', home: 'Inicio', relatedIn: 'Relacionado', tags: 'Tags', postComment: 'Comentar',
      yourName: 'Nombre', writeComment: 'Comentario...', noComments: 'Sin comentarios.', clearSearch: 'Limpiar', video: 'VIDEO', untitled: 'Sin título',
      privacy: 'Privacidad', terms: 'Términos', dmca: 'DMCA', contact: 'Contacto', compliance: '18 U.S.C. 2257',
      allModels: 'Todos los modelos tenían 18+ años.', rtaLabel: 'Sitio RTA.', allRights: 'Todos los derechos reservados',
      legalCompliance: 'Legal', statementTitle: '18 U.S.C. § 2257', statementText: 'Todas las personas tenían 18+ años.',
      ageVerification: 'Verificación de edad', ageVerificationText: 'Debes tener 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Privacidad', termsOfService: 'Términos',
      rtaLabelTitle: 'RTA', lastUpdated: 'Actualizado', online: 'en línea', share: 'Compartir', copyLink: 'Copiar enlace', linkCopied: '¡Enlace copiado!'
    },
    agegate: {
      title: 'Verificación de edad', warning: 'Contenido adulto',
      question: '¿Tienes 18+?', yes: 'Sí', no: 'No',
      disclaimer: 'Al entrar confirmas tener 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galería - Galería Gay Gratis',
      defaultDescription: 'Explora 356.000+ fotos y videos gay gratis.'
    },
    stats: {
      liveStats: 'Estadísticas', onlineNow: 'En línea', today: 'Hoy',
      pageViews: 'Vistas', countries: 'Países', referrers: 'Referencias'
    }
  },
  zh: {
    meta: {
      title: 'BoyVue 画廊 - 免费裸体男孩照片和同志视频',
      description: '浏览350,000+免费裸体男孩照片和同志视频。高清小鲜肉,年轻男子。每日更新。',
      keywords: '裸体男孩, 同志照片, 同志视频, 小鲜肉照片, 男人裸体, 年轻男子裸体, 同志画廊, 免费同志照片'
    },
    ui: {
      allImages: '全部', categories: '分类', search: '搜索', searchPlaceholder: '搜索男孩...', loading: '加载中...',
      prev: '上页', next: '下页', page: '页', of: '共', views: '浏览', rating: '评分', images: '图片', comments: '评论', users: '用户',
      videos: '视频', backToGallery: '返回', home: '首页', relatedIn: '相关', tags: '标签', postComment: '发表',
      yourName: '名字', writeComment: '评论...', noComments: '暂无评论', clearSearch: '清除', video: '视频', untitled: '无标题',
      privacy: '隐私', terms: '条款', dmca: 'DMCA', contact: '联系', compliance: '18 U.S.C. 2257',
      allModels: '所有模特均已满18岁。', rtaLabel: 'RTA标签网站。', allRights: '版权所有',
      legalCompliance: '法律合规', statementTitle: '18 U.S.C. § 2257', statementText: '所有人物在拍摄时均已年满18岁。',
      ageVerification: '年龄验证', ageVerificationText: '您必须年满18岁。', contentRemoval: 'DMCA', privacyPolicy: '隐私政策', termsOfService: '服务条款',
      rtaLabelTitle: 'RTA', lastUpdated: '更新于', online: '在线', share: '分享', copyLink: '复制链接', linkCopied: '链接已复制！'
    },
    agegate: {
      title: '年龄验证', warning: '成人内容',
      question: '您满18岁了吗？', yes: '是', no: '否',
      disclaimer: '进入即确认已满18岁。'
    },
    seo: {
      defaultTitle: 'BoyVue图库 - 免费图库',
      defaultDescription: '浏览356,000+张照片和视频。'
    },
    stats: {
      liveStats: '实时统计', onlineNow: '在线', today: '今日',
      pageViews: '浏览量', countries: '国家', referrers: '来源'
    }
  },
  ja: {
    meta: {
      title: 'BoyVue ギャラリー - 無料ヌード男子写真とゲイ動画',
      description: '350,000以上の無料ヌード男子写真とゲイ動画を閲覧。HDクオリティのツインク、若い男性。毎日更新。',
      keywords: 'ヌード男子, ゲイ写真, ゲイ動画, ツインク写真, 裸の男性, 若い男性ヌード, ゲイギャラリー, 無料ゲイ写真, 日本ゲイ'
    },
    ui: {
      allImages: 'すべて', categories: 'カテゴリ', search: '検索', searchPlaceholder: '男子を検索...', loading: '読み込み中...',
      prev: '前へ', next: '次へ', page: 'ページ', of: '/', views: '閲覧', rating: '評価', images: '画像', comments: 'コメント', users: 'ユーザー',
      videos: '動画', backToGallery: '戻る', home: 'ホーム', relatedIn: '関連', tags: 'タグ', postComment: '投稿',
      yourName: '名前', writeComment: 'コメント...', noComments: 'コメントなし', clearSearch: 'クリア', video: '動画', untitled: '無題',
      privacy: 'プライバシー', terms: '利用規約', dmca: 'DMCA', contact: '連絡先', compliance: '18 U.S.C. 2257',
      allModels: 'すべてのモデルは18歳以上でした。', rtaLabel: 'RTAラベルサイト。', allRights: '全著作権所有',
      legalCompliance: '法的遵守', statementTitle: '18 U.S.C. § 2257', statementText: '描写されたすべての人物は18歳以上でした。',
      ageVerification: '年齢確認', ageVerificationText: '18歳以上である必要があります。', contentRemoval: 'DMCA', privacyPolicy: 'プライバシー', termsOfService: '利用規約',
      rtaLabelTitle: 'RTA', lastUpdated: '更新日', online: 'オンライン', share: '共有', copyLink: 'リンクをコピー', linkCopied: 'リンクをコピーしました！'
    },
    agegate: {
      title: '年齢確認', warning: '成人向け',
      question: '18歳以上ですか？', yes: 'はい', no: 'いいえ',
      disclaimer: '入場で18歳以上を確認。'
    },
    seo: {
      defaultTitle: 'BoyVueギャラリー - 無料ギャラリー',
      defaultDescription: '356,000+枚の写真と動画を閲覧。'
    },
    stats: {
      liveStats: 'リアルタイム統計', onlineNow: 'オンライン', today: '今日',
      pageViews: '閲覧数', countries: '国', referrers: '参照元'
    }
  },
  th: {
    meta: {
      title: 'BoyVue แกลเลอรี่ - รูปหนุ่มเปลือยและวิดีโอเกย์ฟรี',
      description: 'เรียกดูรูปหนุ่มเปลือยและวิดีโอเกย์ฟรีมากกว่า 350,000 รายการ คุณภาพ HD อัปเดตทุกวัน',
      keywords: 'หนุ่มเปลือย, รูปเกย์, วิดีโอเกย์, ทวิงค์, ผู้ชายเปลือย, หนุ่มไทย, แกลเลอรี่เกย์, รูปเกย์ฟรี'
    },
    ui: {
      allImages: 'ทั้งหมด', categories: 'หมวดหมู่', search: 'ค้นหา', searchPlaceholder: 'ค้นหาหนุ่ม...', loading: 'กำลังโหลด...',
      prev: 'ก่อนหน้า', next: 'ถัดไป', page: 'หน้า', of: 'จาก', views: 'ดู', rating: 'คะแนน', images: 'รูป', comments: 'ความคิดเห็น', users: 'ผู้ใช้',
      videos: 'วิดีโอ', backToGallery: 'กลับ', home: 'หน้าแรก', relatedIn: 'ที่เกี่ยวข้อง', tags: 'แท็ก', postComment: 'โพสต์',
      yourName: 'ชื่อ', writeComment: 'ความคิดเห็น...', noComments: 'ยังไม่มีความคิดเห็น', clearSearch: 'ล้าง', video: 'วิดีโอ', untitled: 'ไม่มีชื่อ',
      privacy: 'ความเป็นส่วนตัว', terms: 'ข้อกำหนด', dmca: 'DMCA', contact: 'ติดต่อ', compliance: '18 U.S.C. 2257',
      allModels: 'นางแบบทุกคนมีอายุ 18+ ปี', rtaLabel: 'เว็บไซต์ RTA', allRights: 'สงวนลิขสิทธิ์',
      legalCompliance: 'การปฏิบัติตามกฎหมาย', statementTitle: '18 U.S.C. § 2257', statementText: 'บุคคลทุกคนที่ปรากฏมีอายุ 18+ ปี',
      ageVerification: 'ยืนยันอายุ', ageVerificationText: 'คุณต้องมีอายุ 18+ ปี', contentRemoval: 'DMCA', privacyPolicy: 'นโยบายความเป็นส่วนตัว', termsOfService: 'ข้อกำหนดการใช้งาน',
      rtaLabelTitle: 'RTA', lastUpdated: 'อัปเดตล่าสุด', online: 'ออนไลน์', share: 'แชร์', copyLink: 'คัดลอกลิงก์', linkCopied: 'คัดลอกลิงก์แล้ว!'
    },
    agegate: {
      title: 'ยืนยันอายุ', warning: 'เนื้อหาผู้ใหญ่',
      question: 'คุณอายุ 18+?', yes: 'ใช่', no: 'ไม่',
      disclaimer: 'การเข้าชมยืนยัน 18+'
    },
    seo: {
      defaultTitle: 'BoyVue แกลเลอรี',
      defaultDescription: 'เรียกดู 356,000+ รูปและวิดีโอ'
    },
    stats: {
      liveStats: 'สถิติสด', onlineNow: 'ออนไลน์', today: 'วันนี้',
      pageViews: 'การดู', countries: 'ประเทศ', referrers: 'ผู้อ้างอิง'
    }
  },
  ko: {
    meta: {
      title: 'BoyVue 갤러리 - 무료 누드 남자 사진과 게이 비디오',
      description: '350,000개 이상의 무료 누드 남자 사진과 게이 비디오를 검색하세요. HD 품질, 매일 업데이트.',
      keywords: '누드 남자, 게이 사진, 게이 비디오, 트윙크 사진, 벗은 남자, 젊은 남자 누드, 게이 갤러리, 무료 게이 사진'
    },
    ui: {
      allImages: '전체', categories: '카테고리', search: '검색', searchPlaceholder: '남자 검색...', loading: '로딩 중...',
      prev: '이전', next: '다음', page: '페이지', of: '/', views: '조회', rating: '평점', images: '이미지', comments: '댓글', users: '사용자',
      videos: '비디오', backToGallery: '돌아가기', home: '홈', relatedIn: '관련', tags: '태그', postComment: '댓글 달기',
      yourName: '이름', writeComment: '댓글...', noComments: '댓글 없음', clearSearch: '지우기', video: '비디오', untitled: '제목 없음',
      privacy: '개인정보', terms: '이용약관', dmca: 'DMCA', contact: '연락처', compliance: '18 U.S.C. 2257',
      allModels: '모든 모델은 18세 이상이었습니다.', rtaLabel: 'RTA 라벨 사이트.', allRights: '모든 권리 보유',
      legalCompliance: '법적 준수', statementTitle: '18 U.S.C. § 2257', statementText: '묘사된 모든 사람은 18세 이상이었습니다.',
      ageVerification: '나이 확인', ageVerificationText: '18세 이상이어야 합니다.', contentRemoval: 'DMCA', privacyPolicy: '개인정보 정책', termsOfService: '이용약관',
      rtaLabelTitle: 'RTA', lastUpdated: '업데이트', online: '온라인', share: '공유', copyLink: '링크 복사', linkCopied: '링크가 복사되었습니다!'
    },
    agegate: {
      title: '나이 확인', warning: '성인 콘텐츠',
      question: '18세 이상?', yes: '예', no: '아니오',
      disclaimer: '입장 시 18세 이상 확인.'
    },
    seo: {
      defaultTitle: 'BoyVue 갤러리',
      defaultDescription: '356,000+ 사진과 비디오.'
    },
    stats: {
      liveStats: '실시간 통계', onlineNow: '온라인', today: '오늘',
      pageViews: '조회수', countries: '국가', referrers: '추천'
    }
  },
  pt: {
    meta: {
      title: 'BoyVue Galeria - Fotos de Garotos Nus e Vídeos Gays Grátis',
      description: 'Navegue por mais de 350.000 fotos de garotos nus e vídeos gays grátis. Qualidade HD, atualizado diariamente.',
      keywords: 'garotos nus, fotos gays, vídeos gays, fotos twink, homens nus, jovens nus, galeria gay, fotos gays grátis'
    },
    ui: {
      allImages: 'Todas', categories: 'Categorias', search: 'Buscar', searchPlaceholder: 'Buscar garotos...', loading: 'Carregando...',
      prev: 'Anterior', next: 'Próximo', page: 'Página', of: 'de', views: 'vistas', rating: 'nota', images: 'imagens', comments: 'comentários', users: 'usuários',
      videos: 'vídeos', backToGallery: 'Voltar', home: 'Início', relatedIn: 'Relacionado', tags: 'Tags', postComment: 'Comentar',
      yourName: 'Nome', writeComment: 'Comentário...', noComments: 'Sem comentários.', clearSearch: 'Limpar', video: 'VÍDEO', untitled: 'Sem título',
      privacy: 'Privacidade', terms: 'Termos', dmca: 'DMCA', contact: 'Contato', compliance: '18 U.S.C. 2257',
      allModels: 'Todos os modelos tinham 18+ anos.', rtaLabel: 'Site RTA.', allRights: 'Todos os direitos reservados',
      legalCompliance: 'Conformidade Legal', statementTitle: '18 U.S.C. § 2257', statementText: 'Todas as pessoas retratadas tinham 18+ anos.',
      ageVerification: 'Verificação de Idade', ageVerificationText: 'Você deve ter 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Privacidade', termsOfService: 'Termos',
      rtaLabelTitle: 'RTA', lastUpdated: 'Atualizado', online: 'online', share: 'Compartilhar', copyLink: 'Copiar link', linkCopied: 'Link copiado!'
    },
    agegate: {
      title: 'Verificação de idade', warning: 'Conteúdo adulto',
      question: 'Tem 18+?', yes: 'Sim', no: 'Não',
      disclaimer: 'Ao entrar confirma ter 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galeria - Galeria Gay Grátis',
      defaultDescription: 'Navegue por 356.000+ fotos e vídeos gay grátis.'
    },
    stats: {
      liveStats: 'Estatísticas', onlineNow: 'Online agora', today: 'Hoje',
      pageViews: 'Visualizações', countries: 'Países', referrers: 'Referências'
    }
  },
  fr: {
    meta: {
      title: 'BoyVue Galerie - Photos de Garçons Nus et Vidéos Gay Gratuites',
      description: 'Parcourez plus de 350 000 photos de garçons nus et vidéos gay gratuites. Qualité HD, mise à jour quotidienne.',
      keywords: 'garçons nus, photos gay, vidéos gay, photos twink, hommes nus, jeunes hommes nus, galerie gay, photos gay gratuites'
    },
    ui: {
      allImages: 'Toutes', categories: 'Catégories', search: 'Rechercher', searchPlaceholder: 'Rechercher garçons...', loading: 'Chargement...',
      prev: 'Précédent', next: 'Suivant', page: 'Page', of: 'sur', views: 'vues', rating: 'note', images: 'images', comments: 'commentaires', users: 'utilisateurs',
      videos: 'vidéos', backToGallery: 'Retour', home: 'Accueil', relatedIn: 'Similaire', tags: 'Tags', postComment: 'Commenter',
      yourName: 'Nom', writeComment: 'Commentaire...', noComments: 'Aucun commentaire.', clearSearch: 'Effacer', video: 'VIDÉO', untitled: 'Sans titre',
      privacy: 'Confidentialité', terms: 'Conditions', dmca: 'DMCA', contact: 'Contact', compliance: '18 U.S.C. 2257',
      allModels: 'Tous les modèles avaient 18+ ans.', rtaLabel: 'Site RTA.', allRights: 'Tous droits réservés',
      legalCompliance: 'Conformité Légale', statementTitle: '18 U.S.C. § 2257', statementText: 'Toutes les personnes représentées avaient 18+ ans.',
      ageVerification: "Vérification d'âge", ageVerificationText: 'Vous devez avoir 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Confidentialité', termsOfService: 'Conditions',
      rtaLabelTitle: 'RTA', lastUpdated: 'Mis à jour', online: 'en ligne', share: 'Partager', copyLink: 'Copier le lien', linkCopied: 'Lien copié!'
    },
    agegate: {
      title: "Vérification d'âge", warning: 'Contenu adulte',
      question: '18+?', yes: 'Oui', no: 'Non',
      disclaimer: 'En entrant vous confirmez avoir 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galerie - Galerie Gay Gratuite',
      defaultDescription: 'Parcourez 356 000+ photos et vidéos gay gratuites.'
    },
    stats: {
      liveStats: 'Statistiques en direct', onlineNow: 'En ligne', today: "Aujourd'hui",
      pageViews: 'Vues', countries: 'Pays', referrers: 'Références'
    }
  },
  it: {
    meta: {
      title: 'BoyVue Galleria - Foto di Ragazzi Nudi e Video Gay Gratis',
      description: 'Sfoglia oltre 350.000 foto di ragazzi nudi e video gay gratis. Qualità HD, aggiornato quotidianamente.',
      keywords: 'ragazzi nudi, foto gay, video gay, foto twink, uomini nudi, giovani nudi, galleria gay, foto gay gratis'
    },
    ui: {
      allImages: 'Tutte', categories: 'Categorie', search: 'Cerca', searchPlaceholder: 'Cerca ragazzi...', loading: 'Caricamento...',
      prev: 'Precedente', next: 'Successivo', page: 'Pagina', of: 'di', views: 'viste', rating: 'voto', images: 'immagini', comments: 'commenti', users: 'utenti',
      videos: 'video', backToGallery: 'Indietro', home: 'Home', relatedIn: 'Correlato', tags: 'Tag', postComment: 'Commenta',
      yourName: 'Nome', writeComment: 'Commento...', noComments: 'Nessun commento.', clearSearch: 'Cancella', video: 'VIDEO', untitled: 'Senza titolo',
      privacy: 'Privacy', terms: 'Termini', dmca: 'DMCA', contact: 'Contatto', compliance: '18 U.S.C. 2257',
      allModels: 'Tutti i modelli avevano 18+ anni.', rtaLabel: 'Sito RTA.', allRights: 'Tutti i diritti riservati',
      legalCompliance: 'Conformità Legale', statementTitle: '18 U.S.C. § 2257', statementText: 'Tutte le persone raffigurate avevano 18+ anni.',
      ageVerification: 'Verifica Età', ageVerificationText: 'Devi avere 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Privacy', termsOfService: 'Termini',
      rtaLabelTitle: 'RTA', lastUpdated: 'Aggiornato', online: 'online', share: 'Condividi', copyLink: 'Copia link', linkCopied: 'Link copiato!'
    },
    agegate: {
      title: 'Verifica età', warning: 'Contenuto adulti',
      question: 'Hai 18+?', yes: 'Sì', no: 'No',
      disclaimer: 'Entrando confermi 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galleria - Galleria Gay Gratuita',
      defaultDescription: 'Sfoglia 356.000+ foto e video gay gratuiti.'
    },
    stats: {
      liveStats: 'Statistiche live', onlineNow: 'Online ora', today: 'Oggi',
      pageViews: 'Visualizzazioni', countries: 'Paesi', referrers: 'Referral'
    }
  },
  nl: {
    meta: {
      title: 'BoyVue Galerij - Gratis Naakte Jongens Fotos en Gay Videos',
      description: 'Bekijk meer dan 350.000 gratis naakte jongens fotos en gay videos. HD kwaliteit, dagelijks bijgewerkt.',
      keywords: 'naakte jongens, gay fotos, gay videos, twink fotos, naakte mannen, jonge mannen naakt, gay galerij, gratis gay fotos'
    },
    ui: {
      allImages: 'Alle', categories: 'Categorieën', search: 'Zoeken', searchPlaceholder: 'Zoek jongens...', loading: 'Laden...',
      prev: 'Vorige', next: 'Volgende', page: 'Pagina', of: 'van', views: 'weergaven', rating: 'beoordeling', images: 'afbeeldingen', comments: 'reacties', users: 'gebruikers',
      videos: 'videos', backToGallery: 'Terug', home: 'Home', relatedIn: 'Gerelateerd', tags: 'Tags', postComment: 'Reageren',
      yourName: 'Naam', writeComment: 'Reactie...', noComments: 'Geen reacties.', clearSearch: 'Wissen', video: 'VIDEO', untitled: 'Zonder titel',
      privacy: 'Privacy', terms: 'Voorwaarden', dmca: 'DMCA', contact: 'Contact', compliance: '18 U.S.C. 2257',
      allModels: 'Alle modellen waren 18+ jaar.', rtaLabel: 'RTA gelabelde site.', allRights: 'Alle rechten voorbehouden',
      legalCompliance: 'Juridische Naleving', statementTitle: '18 U.S.C. § 2257', statementText: 'Alle afgebeelde personen waren 18+ jaar.',
      ageVerification: 'Leeftijdsverificatie', ageVerificationText: 'Je moet 18+ zijn.', contentRemoval: 'DMCA', privacyPolicy: 'Privacy', termsOfService: 'Voorwaarden',
      rtaLabelTitle: 'RTA', lastUpdated: 'Bijgewerkt', online: 'online', share: 'Delen', copyLink: 'Link kopiëren', linkCopied: 'Link gekopieerd!'
    },
    agegate: {
      title: 'Leeftijdscheck', warning: 'Volwassen inhoud',
      question: '18+?', yes: 'Ja', no: 'Nee',
      disclaimer: 'Door te betreden bevestig je 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galerij - Gratis Gay Galerij',
      defaultDescription: 'Bekijk 356.000+ gratis gay fotos en videos.'
    },
    stats: {
      liveStats: 'Live statistieken', onlineNow: 'Nu online', today: 'Vandaag',
      pageViews: 'Weergaven', countries: 'Landen', referrers: 'Verwijzers'
    }
  },
  pl: {
    meta: {
      title: 'BoyVue Galeria - Darmowe Zdjęcia Nagich Chłopców i Filmy Gay',
      description: 'Przeglądaj ponad 350 000 darmowych zdjęć nagich chłopców i filmów gay. Jakość HD, aktualizowane codziennie.',
      keywords: 'nadzy chłopcy, zdjęcia gay, filmy gay, zdjęcia twink, nadzy mężczyźni, młodzi mężczyźni nago, galeria gay, darmowe zdjęcia gay'
    },
    ui: {
      allImages: 'Wszystkie', categories: 'Kategorie', search: 'Szukaj', searchPlaceholder: 'Szukaj chłopców...', loading: 'Ładowanie...',
      prev: 'Poprzedni', next: 'Następny', page: 'Strona', of: 'z', views: 'wyświetleń', rating: 'ocena', images: 'zdjęć', comments: 'komentarzy', users: 'użytkowników',
      videos: 'filmów', backToGallery: 'Wróć', home: 'Strona główna', relatedIn: 'Powiązane', tags: 'Tagi', postComment: 'Skomentuj',
      yourName: 'Imię', writeComment: 'Komentarz...', noComments: 'Brak komentarzy.', clearSearch: 'Wyczyść', video: 'WIDEO', untitled: 'Bez tytułu',
      privacy: 'Prywatność', terms: 'Warunki', dmca: 'DMCA', contact: 'Kontakt', compliance: '18 U.S.C. 2257',
      allModels: 'Wszyscy modele mieli 18+ lat.', rtaLabel: 'Strona RTA.', allRights: 'Wszelkie prawa zastrzeżone',
      legalCompliance: 'Zgodność Prawna', statementTitle: '18 U.S.C. § 2257', statementText: 'Wszystkie przedstawione osoby miały 18+ lat.',
      ageVerification: 'Weryfikacja Wieku', ageVerificationText: 'Musisz mieć 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Prywatność', termsOfService: 'Warunki',
      rtaLabelTitle: 'RTA', lastUpdated: 'Zaktualizowano', online: 'online', share: 'Udostępnij', copyLink: 'Kopiuj link', linkCopied: 'Link skopiowany!'
    },
    agegate: {
      title: 'Weryfikacja wieku', warning: 'Treści dla dorosłych',
      question: '18+?', yes: 'Tak', no: 'Nie',
      disclaimer: 'Wchodząc potwierdzasz 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galeria - Darmowa Galeria Gay',
      defaultDescription: 'Przeglądaj 356 000+ zdjęć i filmów gay.'
    },
    stats: {
      liveStats: 'Statystyki na żywo', onlineNow: 'Online teraz', today: 'Dzisiaj',
      pageViews: 'Wyświetlenia', countries: 'Kraje', referrers: 'Odnośniki'
    }
  },
  cs: {
    meta: {
      title: 'BoyVue Galerie - Zdarma Fotky Nahých Kluků a Gay Videa',
      description: 'Prohlížejte více než 350 000 fotek nahých kluků a gay videí zdarma. HD kvalita, denně aktualizováno.',
      keywords: 'nazí kluci, gay fotky, gay videa, twink fotky, nazí muži, mladí muži nazí, gay galerie, gay fotky zdarma'
    },
    ui: {
      allImages: 'Vše', categories: 'Kategorie', search: 'Hledat', searchPlaceholder: 'Hledat kluky...', loading: 'Načítání...',
      prev: 'Předchozí', next: 'Další', page: 'Stránka', of: 'z', views: 'zobrazení', rating: 'hodnocení', images: 'obrázků', comments: 'komentářů', users: 'uživatelů',
      videos: 'videí', backToGallery: 'Zpět', home: 'Domů', relatedIn: 'Podobné', tags: 'Tagy', postComment: 'Komentovat',
      yourName: 'Jméno', writeComment: 'Komentář...', noComments: 'Žádné komentáře.', clearSearch: 'Vymazat', video: 'VIDEO', untitled: 'Bez názvu',
      privacy: 'Soukromí', terms: 'Podmínky', dmca: 'DMCA', contact: 'Kontakt', compliance: '18 U.S.C. 2257',
      allModels: 'Všem modelům bylo 18+ let.', rtaLabel: 'RTA web.', allRights: 'Všechna práva vyhrazena',
      legalCompliance: 'Právní Soulad', statementTitle: '18 U.S.C. § 2257', statementText: 'Všem zobrazeným osobám bylo 18+ let.',
      ageVerification: 'Ověření Věku', ageVerificationText: 'Musíte mít 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Soukromí', termsOfService: 'Podmínky',
      rtaLabelTitle: 'RTA', lastUpdated: 'Aktualizováno', online: 'online', share: 'Sdílet', copyLink: 'Kopírovat odkaz', linkCopied: 'Odkaz zkopírován!'
    },
    agegate: {
      title: 'Ověření věku', warning: 'Obsah pro dospělé',
      question: '18+?', yes: 'Ano', no: 'Ne',
      disclaimer: 'Vstupem potvrzuješ 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galerie - Bezplatná Gay Galerie',
      defaultDescription: 'Prohlížejte 356 000+ fotek a videí.'
    },
    stats: {
      liveStats: 'Živé statistiky', onlineNow: 'Nyní online', today: 'Dnes',
      pageViews: 'Zobrazení', countries: 'Země', referrers: 'Odkazy'
    }
  },
  ar: {
    meta: {
      title: 'معرض BoyVue - صور شباب عراة وفيديوهات مثلية مجانية',
      description: 'تصفح أكثر من 350,000 صورة شباب عراة وفيديوهات مثلية مجانية. جودة عالية، تحديث يومي.',
      keywords: 'شباب عراة, صور مثلية, فيديوهات مثلية, صور توينك, رجال عراة, شباب صغار عراة, معرض مثلي, صور مثلية مجانية'
    },
    ui: {
      allImages: 'الكل', categories: 'الفئات', search: 'بحث', searchPlaceholder: 'ابحث عن شباب...', loading: 'جاري التحميل...',
      prev: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', views: 'مشاهدة', rating: 'تقييم', images: 'صور', comments: 'تعليقات', users: 'مستخدمين',
      videos: 'فيديو', backToGallery: 'العودة', home: 'الرئيسية', relatedIn: 'ذات صلة', tags: 'وسوم', postComment: 'أضف تعليق',
      yourName: 'اسمك', writeComment: 'اكتب تعليق...', noComments: 'لا توجد تعليقات.', clearSearch: 'مسح', video: 'فيديو', untitled: 'بدون عنوان',
      privacy: 'الخصوصية', terms: 'الشروط', dmca: 'DMCA', contact: 'اتصل بنا', compliance: '18 U.S.C. 2257',
      allModels: 'جميع العارضين كانوا 18+ سنة.', rtaLabel: 'موقع RTA.', allRights: 'جميع الحقوق محفوظة',
      legalCompliance: 'الامتثال القانوني', statementTitle: '18 U.S.C. § 2257', statementText: 'جميع الأشخاص المصورين كانوا 18+ سنة.',
      ageVerification: 'التحقق من العمر', ageVerificationText: 'يجب أن يكون عمرك 18+.', contentRemoval: 'DMCA', privacyPolicy: 'سياسة الخصوصية', termsOfService: 'شروط الخدمة',
      rtaLabelTitle: 'RTA', lastUpdated: 'آخر تحديث', online: 'متصل', share: 'مشاركة', copyLink: 'نسخ الرابط', linkCopied: 'تم نسخ الرابط!'
    },
    agegate: {
      title: 'التحقق من العمر', warning: 'محتوى للبالغين',
      question: '18+؟', yes: 'نعم', no: 'لا',
      disclaimer: 'بالدخول تؤكد 18+.'
    },
    seo: {
      defaultTitle: 'معرض BoyVue',
      defaultDescription: 'تصفح 356,000+ صورة وفيديو.'
    },
    stats: {
      liveStats: 'إحصائيات مباشرة', onlineNow: 'متصل الآن', today: 'اليوم',
      pageViews: 'المشاهدات', countries: 'الدول', referrers: 'المصادر'
    }
  },
  el: {
    meta: {
      title: 'BoyVue Gallery - Δωρεάν Φωτογραφίες Γυμνών Αγοριών και Gay Βίντεο',
      description: 'Περιηγηθείτε σε πάνω από 350.000 δωρεάν φωτογραφίες γυμνών αγοριών και gay βίντεο. HD ποιότητα, καθημερινή ενημέρωση.',
      keywords: 'γυμνά αγόρια, gay φωτογραφίες, gay βίντεο, twink φωτογραφίες, γυμνοί άνδρες, νεαροί άνδρες γυμνοί, gay gallery, δωρεάν gay φωτογραφίες'
    },
    ui: {
      allImages: 'Όλα', categories: 'Κατηγορίες', search: 'Αναζήτηση', searchPlaceholder: 'Αναζήτηση αγοριών...', loading: 'Φόρτωση...',
      prev: 'Προηγούμενο', next: 'Επόμενο', page: 'Σελίδα', of: 'από', views: 'προβολές', rating: 'βαθμολογία', images: 'εικόνες', comments: 'σχόλια', users: 'χρήστες',
      videos: 'βίντεο', backToGallery: 'Πίσω', home: 'Αρχική', relatedIn: 'Σχετικά', tags: 'Ετικέτες', postComment: 'Σχολιασμός',
      yourName: 'Όνομα', writeComment: 'Σχόλιο...', noComments: 'Δεν υπάρχουν σχόλια.', clearSearch: 'Καθαρισμός', video: 'ΒΙΝΤΕΟ', untitled: 'Χωρίς τίτλο',
      privacy: 'Απόρρητο', terms: 'Όροι', dmca: 'DMCA', contact: 'Επικοινωνία', compliance: '18 U.S.C. 2257',
      allModels: 'Όλα τα μοντέλα ήταν 18+ ετών.', rtaLabel: 'Ιστοσελίδα RTA.', allRights: 'Όλα τα δικαιώματα διατηρούνται',
      legalCompliance: 'Νομική Συμμόρφωση', statementTitle: '18 U.S.C. § 2257', statementText: 'Όλα τα απεικονιζόμενα άτομα ήταν 18+ ετών.',
      ageVerification: 'Επαλήθευση Ηλικίας', ageVerificationText: 'Πρέπει να είστε 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Πολιτική Απορρήτου', termsOfService: 'Όροι Χρήσης',
      rtaLabelTitle: 'RTA', lastUpdated: 'Τελευταία ενημέρωση', online: 'συνδεδεμένος', share: 'Κοινοποίηση', copyLink: 'Αντιγραφή συνδέσμου', linkCopied: 'Ο σύνδεσμος αντιγράφηκε!'
    },
    agegate: {
      title: 'Επαλήθευση ηλικίας', warning: 'Περιεχόμενο ενηλίκων',
      question: '18+;', yes: 'Ναι', no: 'Όχι',
      disclaimer: 'Εισερχόμενοι επιβεβαιώνετε 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Gallery - Δωρεάν Gay Γκαλερί',
      defaultDescription: 'Περιηγηθείτε σε 356.000+ φωτογραφίες και βίντεο.'
    },
    stats: {
      liveStats: 'Ζωντανά στατιστικά', onlineNow: 'Online τώρα', today: 'Σήμερα',
      pageViews: 'Προβολές', countries: 'Χώρες', referrers: 'Παραπομπές'
    }
  },
  vi: {
    meta: {
      title: 'BoyVue Gallery - Ảnh Trai Khỏa Thân và Video Gay Miễn Phí',
      description: 'Xem hơn 350.000 ảnh trai khỏa thân và video gay miễn phí. Chất lượng HD, cập nhật hàng ngày.',
      keywords: 'trai khỏa thân, ảnh gay, video gay, ảnh twink, đàn ông khỏa thân, trai trẻ khỏa thân, gallery gay, ảnh gay miễn phí'
    },
    ui: {
      allImages: 'Tất cả', categories: 'Danh mục', search: 'Tìm kiếm', searchPlaceholder: 'Tìm trai...', loading: 'Đang tải...',
      prev: 'Trước', next: 'Sau', page: 'Trang', of: '/', views: 'lượt xem', rating: 'đánh giá', images: 'ảnh', comments: 'bình luận', users: 'người dùng',
      videos: 'video', backToGallery: 'Quay lại', home: 'Trang chủ', relatedIn: 'Liên quan', tags: 'Tags', postComment: 'Bình luận',
      yourName: 'Tên', writeComment: 'Bình luận...', noComments: 'Chưa có bình luận.', clearSearch: 'Xóa', video: 'VIDEO', untitled: 'Không tiêu đề',
      privacy: 'Quyền riêng tư', terms: 'Điều khoản', dmca: 'DMCA', contact: 'Liên hệ', compliance: '18 U.S.C. 2257',
      allModels: 'Tất cả người mẫu đều trên 18 tuổi.', rtaLabel: 'Trang RTA.', allRights: 'Bảo lưu mọi quyền',
      legalCompliance: 'Tuân Thủ Pháp Lý', statementTitle: '18 U.S.C. § 2257', statementText: 'Tất cả người xuất hiện đều trên 18 tuổi.',
      ageVerification: 'Xác Minh Tuổi', ageVerificationText: 'Bạn phải trên 18 tuổi.', contentRemoval: 'DMCA', privacyPolicy: 'Quyền riêng tư', termsOfService: 'Điều khoản',
      rtaLabelTitle: 'RTA', lastUpdated: 'Cập nhật', online: 'trực tuyến', share: 'Chia sẻ', copyLink: 'Sao chép liên kết', linkCopied: 'Đã sao chép liên kết!'
    },
    agegate: {
      title: 'Xác minh tuổi', warning: 'Nội dung người lớn',
      question: '18+?', yes: 'Có', no: 'Không',
      disclaimer: 'Khi vào bạn xác nhận 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Gallery - Gallery Gay Miễn Phí',
      defaultDescription: 'Xem hơn 356.000 ảnh và video.'
    },
    stats: {
      liveStats: 'Thống kê trực tiếp', onlineNow: 'Đang online', today: 'Hôm nay',
      pageViews: 'Lượt xem', countries: 'Quốc gia', referrers: 'Nguồn giới thiệu'
    }
  },
  id: {
    meta: {
      title: 'BoyVue Galeri - Foto Cowok Telanjang dan Video Gay Gratis',
      description: 'Jelajahi lebih dari 350.000 foto cowok telanjang dan video gay gratis. Kualitas HD, diperbarui setiap hari.',
      keywords: 'cowok telanjang, foto gay, video gay, foto twink, pria telanjang, pemuda telanjang, galeri gay, foto gay gratis'
    },
    ui: {
      allImages: 'Semua', categories: 'Kategori', search: 'Cari', searchPlaceholder: 'Cari cowok...', loading: 'Memuat...',
      prev: 'Sebelumnya', next: 'Selanjutnya', page: 'Halaman', of: 'dari', views: 'dilihat', rating: 'rating', images: 'gambar', comments: 'komentar', users: 'pengguna',
      videos: 'video', backToGallery: 'Kembali', home: 'Beranda', relatedIn: 'Terkait', tags: 'Tag', postComment: 'Komentar',
      yourName: 'Nama', writeComment: 'Komentar...', noComments: 'Belum ada komentar.', clearSearch: 'Hapus', video: 'VIDEO', untitled: 'Tanpa judul',
      privacy: 'Privasi', terms: 'Ketentuan', dmca: 'DMCA', contact: 'Kontak', compliance: '18 U.S.C. 2257',
      allModels: 'Semua model berusia 18+ tahun.', rtaLabel: 'Situs RTA.', allRights: 'Semua hak dilindungi',
      legalCompliance: 'Kepatuhan Hukum', statementTitle: '18 U.S.C. § 2257', statementText: 'Semua orang yang ditampilkan berusia 18+ tahun.',
      ageVerification: 'Verifikasi Usia', ageVerificationText: 'Anda harus berusia 18+.', contentRemoval: 'DMCA', privacyPolicy: 'Privasi', termsOfService: 'Ketentuan',
      rtaLabelTitle: 'RTA', lastUpdated: 'Diperbarui', online: 'online', share: 'Bagikan', copyLink: 'Salin tautan', linkCopied: 'Tautan disalin!'
    },
    agegate: {
      title: 'Verifikasi usia', warning: 'Konten dewasa',
      question: '18+?', yes: 'Ya', no: 'Tidak',
      disclaimer: 'Dengan masuk konfirmasi 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galeri - Galeri Gay Gratis',
      defaultDescription: 'Jelajahi 356.000+ foto dan video.'
    },
    stats: {
      liveStats: 'Statistik langsung', onlineNow: 'Online sekarang', today: 'Hari ini',
      pageViews: 'Tampilan', countries: 'Negara', referrers: 'Perujuk'
    }
  },
  tr: {
    meta: {
      title: 'BoyVue Galeri - Ücretsiz Çıplak Erkek Fotoğrafları ve Gay Videoları',
      description: "350.000'den fazla ücretsiz çıplak erkek fotoğrafı ve gay videosu keşfedin. HD kalite, günlük güncelleme.",
      keywords: 'çıplak erkekler, gay fotoğrafları, gay videoları, twink fotoğrafları, çıplak adamlar, genç erkekler çıplak, gay galeri, ücretsiz gay fotoğrafları'
    },
    ui: {
      allImages: 'Tümü', categories: 'Kategoriler', search: 'Ara', searchPlaceholder: 'Erkek ara...', loading: 'Yükleniyor...',
      prev: 'Önceki', next: 'Sonraki', page: 'Sayfa', of: '/', views: 'görüntüleme', rating: 'puan', images: 'resim', comments: 'yorum', users: 'kullanıcı',
      videos: 'video', backToGallery: 'Geri', home: 'Ana Sayfa', relatedIn: 'İlgili', tags: 'Etiketler', postComment: 'Yorum Yap',
      yourName: 'İsim', writeComment: 'Yorum...', noComments: 'Yorum yok.', clearSearch: 'Temizle', video: 'VİDEO', untitled: 'Başlıksız',
      privacy: 'Gizlilik', terms: 'Şartlar', dmca: 'DMCA', contact: 'İletişim', compliance: '18 U.S.C. 2257',
      allModels: 'Tüm modeller 18+ yaşındaydı.', rtaLabel: 'RTA sitesi.', allRights: 'Tüm hakları saklıdır',
      legalCompliance: 'Yasal Uyum', statementTitle: '18 U.S.C. § 2257', statementText: 'Tüm kişiler 18+ yaşındaydı.',
      ageVerification: 'Yaş Doğrulama', ageVerificationText: '18+ olmalısınız.', contentRemoval: 'DMCA', privacyPolicy: 'Gizlilik', termsOfService: 'Şartlar',
      rtaLabelTitle: 'RTA', lastUpdated: 'Güncellendi', online: 'çevrimiçi', share: 'Paylaş', copyLink: 'Bağlantıyı kopyala', linkCopied: 'Bağlantı kopyalandı!'
    },
    agegate: {
      title: 'Yaş doğrulama', warning: 'Yetişkin içerik',
      question: '18+?', yes: 'Evet', no: 'Hayır',
      disclaimer: 'Girerek 18+ onaylarsınız.'
    },
    seo: {
      defaultTitle: 'BoyVue Galeri',
      defaultDescription: "356.000+ fotoğraf ve video."
    },
    stats: {
      liveStats: 'Canlı istatistikler', onlineNow: 'Şu an çevrimiçi', today: 'Bugün',
      pageViews: 'Görüntüleme', countries: 'Ülkeler', referrers: 'Yönlendirenler'
    }
  },
  hu: {
    meta: {
      title: 'BoyVue Galéria - Ingyenes Meztelen Fiú Képek és Meleg Videók',
      description: 'Böngésszen több mint 350.000 ingyenes meztelen fiú képet és meleg videót. HD minőség, naponta frissítve.',
      keywords: 'meztelen fiúk, meleg képek, meleg videók, twink képek, meztelen férfiak, fiatal férfiak meztelenül, meleg galéria, ingyenes meleg képek'
    },
    ui: {
      allImages: 'Összes', categories: 'Kategóriák', search: 'Keresés', searchPlaceholder: 'Fiúk keresése...', loading: 'Betöltés...',
      prev: 'Előző', next: 'Következő', page: 'Oldal', of: '/', views: 'nézet', rating: 'értékelés', images: 'kép', comments: 'hozzászólás', users: 'felhasználó',
      videos: 'videó', backToGallery: 'Vissza', home: 'Főoldal', relatedIn: 'Kapcsolódó', tags: 'Címkék', postComment: 'Hozzászólás',
      yourName: 'Név', writeComment: 'Hozzászólás...', noComments: 'Nincs hozzászólás.', clearSearch: 'Törlés', video: 'VIDEÓ', untitled: 'Cím nélkül',
      privacy: 'Adatvédelem', terms: 'Feltételek', dmca: 'DMCA', contact: 'Kapcsolat', compliance: '18 U.S.C. 2257',
      allModels: 'Minden modell 18+ éves volt.', rtaLabel: 'RTA oldal.', allRights: 'Minden jog fenntartva',
      legalCompliance: 'Jogi megfelelés', statementTitle: '18 U.S.C. § 2257', statementText: 'Minden ábrázolt személy 18+ éves volt.',
      ageVerification: 'Életkor ellenőrzés', ageVerificationText: '18+ évesnek kell lenned.', contentRemoval: 'DMCA', privacyPolicy: 'Adatvédelem', termsOfService: 'Feltételek',
      rtaLabelTitle: 'RTA', lastUpdated: 'Frissítve', online: 'online', share: 'Megosztás', copyLink: 'Link másolása', linkCopied: 'Link másolva!'
    },
    agegate: {
      title: 'Életkor ellenőrzés', warning: 'Felnőtt tartalom',
      question: '18+?', yes: 'Igen', no: 'Nem',
      disclaimer: 'Belépéssel megerősíted 18+.'
    },
    seo: {
      defaultTitle: 'BoyVue Galéria - Ingyenes Meleg Galéria',
      defaultDescription: 'Böngésszen 356.000+ képet és videót.'
    },
    stats: {
      liveStats: 'Élő statisztikák', onlineNow: 'Most online', today: 'Ma',
      pageViews: 'Megtekintések', countries: 'Országok', referrers: 'Hivatkozók'
    }
  }
};

async function seedTranslations() {
  console.log('Starting translation seeding...');

  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL,
        language VARCHAR(10) NOT NULL,
        value TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'ui',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(key, language)
      );
      CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON translations(key, language);
      CREATE INDEX IF NOT EXISTS idx_translations_category ON translations(category);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS languages (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        native_name VARCHAR(100),
        flag VARCHAR(10),
        direction VARCHAR(3) DEFAULT 'ltr',
        enabled BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert languages
    const languages = [
      { code: 'en', name: 'English', native: 'English', flag: '🇬🇧', dir: 'ltr', order: 1 },
      { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪', dir: 'ltr', order: 2 },
      { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺', dir: 'ltr', order: 3 },
      { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸', dir: 'ltr', order: 4 },
      { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳', dir: 'ltr', order: 5 },
      { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', dir: 'ltr', order: 6 },
      { code: 'th', name: 'Thai', native: 'ไทย', flag: '🇹🇭', dir: 'ltr', order: 7 },
      { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', dir: 'ltr', order: 8 },
      { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷', dir: 'ltr', order: 9 },
      { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷', dir: 'ltr', order: 10 },
      { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹', dir: 'ltr', order: 11 },
      { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱', dir: 'ltr', order: 12 },
      { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱', dir: 'ltr', order: 13 },
      { code: 'cs', name: 'Czech', native: 'Čeština', flag: '🇨🇿', dir: 'ltr', order: 14 },
      { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦', dir: 'rtl', order: 15 },
      { code: 'el', name: 'Greek', native: 'Ελληνικά', flag: '🇬🇷', dir: 'ltr', order: 16 },
      { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳', dir: 'ltr', order: 17 },
      { code: 'id', name: 'Indonesian', native: 'Indonesia', flag: '🇮🇩', dir: 'ltr', order: 18 },
      { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', dir: 'ltr', order: 19 },
      { code: 'hu', name: 'Hungarian', native: 'Magyar', flag: '🇭🇺', dir: 'ltr', order: 20 }
    ];

    for (const lang of languages) {
      await pool.query(
        `INSERT INTO languages (code, name, native_name, flag, direction, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = $2, native_name = $3, flag = $4, direction = $5, sort_order = $6`,
        [lang.code, lang.name, lang.native, lang.flag, lang.dir, lang.order]
      );
    }
    console.log('Languages inserted successfully');

    // Insert translations
    let count = 0;
    for (const [lang, categories] of Object.entries(translations)) {
      for (const [category, items] of Object.entries(categories)) {
        for (const [key, value] of Object.entries(items)) {
          const fullKey = `${category}.${key}`;
          await pool.query(
            `INSERT INTO translations (key, language, value, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (key, language) DO UPDATE SET value = $3, updated_at = NOW()`,
            [fullKey, lang, value, category]
          );
          count++;
        }
      }
    }

    console.log(`Seeded ${count} translations successfully!`);

    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM translations');
    console.log(`Total translations in DB: ${result.rows[0].count}`);

    const langResult = await pool.query('SELECT COUNT(*) FROM languages');
    console.log(`Total languages in DB: ${langResult.rows[0].count}`);

  } catch (error) {
    console.error('Error seeding translations:', error);
  } finally {
    await pool.end();
  }
}

seedTranslations();
