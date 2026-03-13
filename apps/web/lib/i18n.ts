// Klovi i18n — English, Hindi, Spanish
// Usage: const t = useT(language); t('key')

type Lang = 'en' | 'hi' | 'es';

const translations: Record<string, Record<Lang, string>> = {
  // ─── Onboarding: Setup ────────────────────────────────────────────────
  'setup.title': { en: "Let's set you up", hi: 'चलिए शुरू करते हैं', es: 'Vamos a configurarte' },
  'setup.subtitle': { en: 'Takes 30 seconds', hi: '30 सेकंड लगेंगे', es: 'Toma 30 segundos' },
  'setup.language': { en: 'Language', hi: 'भाषा', es: 'Idioma' },
  'setup.whatSell': { en: 'What do you sell?', hi: 'आप क्या बेचते हैं?', es: '¿Qué vendes?' },
  'setup.pickAll': { en: 'pick all that apply', hi: 'सभी चुनें जो लागू हों', es: 'elige todos los que apliquen' },
  'setup.other': { en: 'Other / Custom', hi: 'अन्य / कस्टम', es: 'Otro / Personalizado' },
  'setup.descBusiness': { en: 'Describe your business', hi: 'अपना व्यापार बताएं', es: 'Describe tu negocio' },
  'setup.descPlaceholder': { en: 'e.g., I make homemade cakes and cookies', hi: 'जैसे, मैं घर पर केक और कुकीज़ बनाती हूँ', es: 'ej., Hago pasteles y galletas caseras' },
  'setup.city': { en: 'Your city', hi: 'आपका शहर', es: 'Tu ciudad' },
  'setup.cityPlaceholder': { en: 'e.g., Jaipur', hi: 'जैसे, जयपुर', es: 'ej., Ciudad de México' },
  'setup.country': { en: 'Country', hi: 'देश', es: 'País' },
  'setup.foodType': { en: 'What kind of food?', hi: 'किस तरह का खाना?', es: '¿Qué tipo de comida?' },
  'setup.next': { en: 'Next', hi: 'आगे', es: 'Siguiente' },
  'setup.saving': { en: 'Saving...', hi: 'सेव हो रहा है...', es: 'Guardando...' },

  // ─── Onboarding: Products ─────────────────────────────────────────────
  'products.title': { en: 'Add your products', hi: 'अपने प्रोडक्ट जोड़ें', es: 'Agrega tus productos' },
  'products.subtitle': { en: 'You can always add more later', hi: 'बाद में और जोड़ सकते हैं', es: 'Puedes agregar más después' },
  'products.photo': { en: 'Photo of Menu', hi: 'मेनू की फोटो', es: 'Foto del menú' },
  'products.voice': { en: 'Speak your menu', hi: 'बोलकर बताएं', es: 'Dicta tu menú' },
  'products.type': { en: 'Type manually', hi: 'खुद लिखें', es: 'Escribe manualmente' },
  'products.catalog': { en: 'Pick from catalog', hi: 'कैटलॉग से चुनें', es: 'Elegir del catálogo' },
  'products.added': { en: 'products added', hi: 'प्रोडक्ट जोड़े गए', es: 'productos agregados' },
  'products.noProducts': { en: 'No products yet', hi: 'अभी कोई प्रोडक्ट नहीं', es: 'Aún no hay productos' },
  'products.addFirst': { en: 'Add your first product using any method above', hi: 'ऊपर दिए तरीकों से पहला प्रोडक्ट जोड़ें', es: 'Agrega tu primer producto usando cualquier método' },
  'products.name': { en: 'Product name', hi: 'प्रोडक्ट का नाम', es: 'Nombre del producto' },
  'products.desc': { en: 'Description', hi: 'विवरण', es: 'Descripción' },
  'products.price': { en: 'Price', hi: 'कीमत', es: 'Precio' },
  'products.save': { en: 'Save', hi: 'सेव करें', es: 'Guardar' },
  'products.cancel': { en: 'Cancel', hi: 'रद्द करें', es: 'Cancelar' },
  'products.delete': { en: 'Delete', hi: 'हटाएं', es: 'Eliminar' },
  'products.edit': { en: 'Edit', hi: 'बदलें', es: 'Editar' },
  'products.selectAll': { en: 'Select All', hi: 'सभी चुनें', es: 'Seleccionar todo' },
  'products.addSelected': { en: 'Add Selected', hi: 'चुने हुए जोड़ें', es: 'Agregar seleccionados' },
  'products.variants': { en: 'Variants', hi: 'वेरिएंट', es: 'Variantes' },

  // ─── Onboarding: Import ───────────────────────────────────────────────
  'import.title': { en: 'Review your menu', hi: 'अपना मेनू देखें', es: 'Revisa tu menú' },
  'import.subtitle': { en: 'Edit anything that doesn\'t look right', hi: 'जो सही न लगे उसे बदलें', es: 'Edita lo que no se vea bien' },
  'import.looksGood': { en: 'Looks good!', hi: 'सब सही है!', es: '¡Se ve bien!' },
  'import.importMore': { en: 'Import more', hi: 'और इम्पोर्ट करें', es: 'Importar más' },

  // ─── Onboarding: Channels ─────────────────────────────────────────────
  'channels.payment': { en: 'Payment Methods', hi: 'भुगतान के तरीके', es: 'Métodos de pago' },
  'channels.paymentSub': { en: 'How will customers pay you?', hi: 'ग्राहक आपको कैसे भुगतान करेंगे?', es: '¿Cómo te pagarán los clientes?' },
  'channels.comm': { en: 'Communication', hi: 'संपर्क', es: 'Comunicación' },
  'channels.commSub': { en: 'Where do your customers reach you?', hi: 'ग्राहक आपसे कहाँ संपर्क करते हैं?', es: '¿Dónde te contactan tus clientes?' },
  'channels.whatsapp': { en: 'WhatsApp number', hi: 'WhatsApp नंबर', es: 'Número de WhatsApp' },
  'channels.instagram': { en: 'Instagram handle', hi: 'Instagram हैंडल', es: 'Usuario de Instagram' },
  'channels.facebook': { en: 'Facebook page', hi: 'Facebook पेज', es: 'Página de Facebook' },
  'channels.cash': { en: 'Cash on Pickup', hi: 'पिकअप पर नकद', es: 'Efectivo al recoger' },
  'channels.upi': { en: 'UPI / Google Pay', hi: 'UPI / Google Pay', es: 'UPI / Google Pay' },
  'channels.stripe': { en: 'Cards & Online', hi: 'कार्ड और ऑनलाइन', es: 'Tarjetas y en línea' },
  'channels.zelle': { en: 'Zelle', hi: 'Zelle', es: 'Zelle' },
  'channels.launchPost': { en: 'Your launch post', hi: 'आपकी लॉन्च पोस्ट', es: 'Tu post de lanzamiento' },
  'channels.download': { en: 'Download Image', hi: 'इमेज डाउनलोड करें', es: 'Descargar imagen' },
  'channels.goLive': { en: 'Go Live!', hi: 'लाइव करें!', es: '¡Ir en vivo!' },

  // ─── Onboarding: Preview ──────────────────────────────────────────────
  'preview.title': { en: 'Preview your shop', hi: 'अपनी दुकान देखें', es: 'Vista previa de tu tienda' },
  'preview.subtitle': { en: 'This is how customers will see your shop', hi: 'ग्राहक आपकी दुकान ऐसे देखेंगे', es: 'Así verán los clientes tu tienda' },
  'preview.looksGood': { en: 'Looks good, go live!', hi: 'सब सही है, लाइव करें!', es: '¡Se ve bien, ir en vivo!' },
  'preview.goBack': { en: 'Go back & edit', hi: 'वापस जाएं और बदलें', es: 'Volver y editar' },
  'preview.yourLink': { en: 'Your shop link', hi: 'आपकी दुकान का लिंक', es: 'Enlace de tu tienda' },

  // ─── Onboarding: Live ─────────────────────────────────────────────────
  'live.title': { en: "YOU'RE LIVE!", hi: 'आप लाइव हैं!', es: '¡ESTÁS EN VIVO!' },
  'live.subtitle': { en: 'is open for orders', hi: 'ऑर्डर के लिए खुला है', es: 'está abierto para pedidos' },
  'live.shopLink': { en: 'Your shop link', hi: 'आपकी दुकान का लिंक', es: 'Enlace de tu tienda' },
  'live.copy': { en: 'Copy Link', hi: 'लिंक कॉपी करें', es: 'Copiar enlace' },
  'live.share': { en: 'Share', hi: 'शेयर करें', es: 'Compartir' },
  'live.shareWhatsApp': { en: 'Share to WhatsApp group', hi: 'WhatsApp ग्रुप में शेयर करें', es: 'Compartir en grupo de WhatsApp' },
  'live.shareInsta': { en: 'Share to Instagram story', hi: 'Instagram स्टोरी में शेयर करें', es: 'Compartir en historia de Instagram' },
  'live.shareFb': { en: 'Share to Facebook', hi: 'Facebook पर शेयर करें', es: 'Compartir en Facebook' },
  'live.launchPost': { en: 'Share your launch post', hi: 'अपनी लॉन्च पोस्ट शेयर करें', es: 'Comparte tu post de lanzamiento' },
  'live.downloadImage': { en: 'Download Image', hi: 'इमेज डाउनलोड करें', es: 'Descargar imagen' },
  'live.shareNow': { en: 'Share Now', hi: 'अभी शेयर करें', es: 'Compartir ahora' },
  'live.dashboard': { en: 'Go to my Dashboard', hi: 'मेरा डैशबोर्ड देखें', es: 'Ir a mi panel' },

  // ─── Dashboard ────────────────────────────────────────────────────────
  'dash.morning': { en: 'Good morning', hi: 'सुप्रभात', es: 'Buenos días' },
  'dash.afternoon': { en: 'Good afternoon', hi: 'नमस्ते', es: 'Buenas tardes' },
  'dash.evening': { en: 'Good evening', hi: 'शुभ संध्या', es: 'Buenas noches' },
  'dash.shopLink': { en: 'Your shop link', hi: 'आपकी दुकान का लिंक', es: 'Enlace de tu tienda' },
  'dash.copyLink': { en: 'Copy Link', hi: 'लिंक कॉपी करें', es: 'Copiar enlace' },
  'dash.copied': { en: 'Copied!', hi: 'कॉपी हो गया!', es: '¡Copiado!' },
  'dash.products': { en: 'Products', hi: 'प्रोडक्ट', es: 'Productos' },
  'dash.available': { en: 'available', hi: 'उपलब्ध', es: 'disponible' },
  'dash.todayOrders': { en: "Today's Orders", hi: 'आज के ऑर्डर', es: 'Pedidos de hoy' },
  'dash.earned': { en: 'earned', hi: 'कमाई', es: 'ganado' },
  'dash.unread': { en: 'Unread Messages', hi: 'अपठित संदेश', es: 'Mensajes sin leer' },
  'dash.needsReply': { en: 'Needs reply', hi: 'जवाब दें', es: 'Necesita respuesta' },
  'dash.customers': { en: 'Customers', hi: 'ग्राहक', es: 'Clientes' },
  'dash.attention': { en: 'Needs your attention', hi: 'आपके ध्यान की ज़रूरत', es: 'Necesita tu atención' },
  'dash.ordersPending': { en: 'orders pending', hi: 'ऑर्डर बाकी हैं', es: 'pedidos pendientes' },
  'dash.reviewConfirm': { en: 'Review and confirm', hi: 'देखें और पुष्टि करें', es: 'Revisar y confirmar' },
  'dash.unreadMsg': { en: 'unread messages', hi: 'अपठित संदेश', es: 'mensajes sin leer' },
  'dash.replyHappy': { en: 'Reply to keep customers happy', hi: 'ग्राहकों को खुश रखने के लिए जवाब दें', es: 'Responde para mantener clientes contentos' },
  'dash.getReady': { en: 'Get your shop ready', hi: 'अपनी दुकान तैयार करें', es: 'Prepara tu tienda' },
  'dash.addProducts': { en: 'Add your products', hi: 'अपने प्रोडक्ट जोड़ें', es: 'Agrega tus productos' },
  'dash.productsAdded': { en: 'products added', hi: 'प्रोडक्ट जोड़े गए', es: 'productos agregados' },
  'dash.listSell': { en: 'List what you sell with photos and prices', hi: 'फोटो और कीमत के साथ प्रोडक्ट जोड़ें', es: 'Lista lo que vendes con fotos y precios' },
  'dash.connectWA': { en: 'Connect WhatsApp', hi: 'WhatsApp कनेक्ट करें', es: 'Conectar WhatsApp' },
  'dash.connected': { en: 'Connected', hi: 'कनेक्ट है', es: 'Conectado' },
  'dash.soCustomers': { en: 'So customers can message you', hi: 'ताकि ग्राहक आपको मैसेज कर सकें', es: 'Para que los clientes puedan escribirte' },
  'dash.setDelivery': { en: 'Set delivery options', hi: 'डिलीवरी ऑप्शन सेट करें', es: 'Configurar opciones de entrega' },
  'dash.configured': { en: 'Configured', hi: 'सेट है', es: 'Configurado' },
  'dash.pickupDelivery': { en: 'Pickup, delivery, or both', hi: 'पिकअप, डिलीवरी, या दोनों', es: 'Recogida, entrega, o ambos' },
  'dash.shareLink': { en: 'Share your shop link', hi: 'अपनी दुकान का लिंक शेयर करें', es: 'Comparte el enlace de tu tienda' },
  'dash.shareSubtitle': { en: 'Send to friends, post on social media', hi: 'दोस्तों को भेजें, सोशल मीडिया पर पोस्ट करें', es: 'Envía a amigos, publica en redes sociales' },
  'dash.quickActions': { en: 'Quick actions', hi: 'त्वरित कार्य', es: 'Acciones rápidas' },
  'dash.addProduct': { en: 'Add Product', hi: 'प्रोडक्ट जोड़ें', es: 'Agregar producto' },
  'dash.broadcast': { en: 'Send Broadcast', hi: 'ब्रॉडकास्ट भेजें', es: 'Enviar difusión' },
  'dash.createPost': { en: 'Create Post', hi: 'पोस्ट बनाएं', es: 'Crear publicación' },
  'dash.settings': { en: 'Settings', hi: 'सेटिंग्स', es: 'Configuración' },
  'dash.loading': { en: 'Loading...', hi: 'लोड हो रहा है...', es: 'Cargando...' },

  // ─── Nav ──────────────────────────────────────────────────────────────
  'nav.home': { en: 'Home', hi: 'होम', es: 'Inicio' },
  'nav.orders': { en: 'Orders', hi: 'ऑर्डर', es: 'Pedidos' },
  'nav.inbox': { en: 'Inbox', hi: 'इनबॉक्स', es: 'Bandeja' },
  'nav.products': { en: 'Products', hi: 'प्रोडक्ट', es: 'Productos' },
  'nav.customers': { en: 'Customers', hi: 'ग्राहक', es: 'Clientes' },
  'nav.broadcasts': { en: 'Broadcasts', hi: 'ब्रॉडकास्ट', es: 'Difusiones' },
  'nav.posts': { en: 'Posts', hi: 'पोस्ट', es: 'Publicaciones' },
  'nav.reviews': { en: 'Reviews', hi: 'समीक्षा', es: 'Reseñas' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स', es: 'Configuración' },
  'nav.more': { en: 'More', hi: 'और', es: 'Más' },
  'nav.logout': { en: 'Log out', hi: 'लॉग आउट', es: 'Cerrar sesión' },

  // ─── Common ───────────────────────────────────────────────────────────
  'common.next': { en: 'Next', hi: 'आगे', es: 'Siguiente' },
  'common.back': { en: 'Back', hi: 'वापस', es: 'Atrás' },
  'common.save': { en: 'Save', hi: 'सेव करें', es: 'Guardar' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें', es: 'Cancelar' },
  'common.delete': { en: 'Delete', hi: 'हटाएं', es: 'Eliminar' },
  'common.edit': { en: 'Edit', hi: 'बदलें', es: 'Editar' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...', es: 'Cargando...' },
  'common.saving': { en: 'Saving...', hi: 'सेव हो रहा है...', es: 'Guardando...' },
  'common.search': { en: 'Search...', hi: 'खोजें...', es: 'Buscar...' },

  // ─── Auth ─────────────────────────────────────────────────────────────
  'auth.signIn': { en: 'Sign in to your dashboard', hi: 'अपने डैशबोर्ड में साइन इन करें', es: 'Inicia sesión en tu panel' },
  'auth.signUp': { en: 'Start your business journey', hi: 'अपना बिज़नेस शुरू करें', es: 'Comienza tu negocio' },
  'auth.google': { en: 'Continue with Google', hi: 'Google से जारी रखें', es: 'Continuar con Google' },
  'auth.email': { en: 'Email', hi: 'ईमेल', es: 'Correo electrónico' },
  'auth.phone': { en: 'Phone', hi: 'फोन', es: 'Teléfono' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड', es: 'Contraseña' },
  'auth.signInBtn': { en: 'Sign In', hi: 'साइन इन', es: 'Iniciar sesión' },
  'auth.signingIn': { en: 'Signing in...', hi: 'साइन इन हो रहा है...', es: 'Iniciando sesión...' },
  'auth.createAccount': { en: 'Create Free Account', hi: 'फ्री अकाउंट बनाएं', es: 'Crear cuenta gratis' },
  'auth.creating': { en: 'Creating account...', hi: 'अकाउंट बन रहा है...', es: 'Creando cuenta...' },
  'auth.businessName': { en: 'Business Name', hi: 'बिज़नेस का नाम', es: 'Nombre del negocio' },
  'auth.businessPlaceholder': { en: "e.g., Sunita's Kitchen", hi: 'जैसे, सुनीता की रसोई', es: 'ej., Cocina de María' },
  'auth.noAccount': { en: "Don't have an account?", hi: 'अकाउंट नहीं है?', es: '¿No tienes cuenta?' },
  'auth.haveAccount': { en: 'Already have an account?', hi: 'पहले से अकाउंट है?', es: '¿Ya tienes cuenta?' },
  'auth.sendOtp': { en: 'Send OTP', hi: 'OTP भेजें', es: 'Enviar OTP' },
  'auth.verifyOtp': { en: 'Verify OTP', hi: 'OTP सत्यापित करें', es: 'Verificar OTP' },
  'auth.changeNumber': { en: 'Change number', hi: 'नंबर बदलें', es: 'Cambiar número' },

  // ─── Progress bar ─────────────────────────────────────────────────────
  'step.setup': { en: 'Setup', hi: 'सेटअप', es: 'Configurar' },
  'step.products': { en: 'Products', hi: 'प्रोडक्ट', es: 'Productos' },
  'step.review': { en: 'Review', hi: 'समीक्षा', es: 'Revisar' },
  'step.channels': { en: 'Channels', hi: 'चैनल', es: 'Canales' },
  'step.preview': { en: 'Preview', hi: 'प्रीव्यू', es: 'Vista previa' },
  'step.live': { en: 'Live!', hi: 'लाइव!', es: '¡En vivo!' },
};

export function t(key: string, lang: string = 'en'): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[(lang as Lang)] || entry.en || key;
}

export type { Lang };
