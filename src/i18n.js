const STORAGE_KEY = "rippleAquariumLanguage";

const translations = {
  zh: {
    title: "涟漪鱼缸",
    topLinksAria: "项目链接",
    languageAria: "语言切换",
    repoTitle: "在 GitHub 上查看项目",
    repoAria: "在 GitHub 上查看涟漪鱼缸源码",
    loadingAria: "加载鱼模型",
    loading: "加载中..",
    controlsAria: "鱼缸控制参数",
    hideParams: "隐藏参数",
    showParams: "显示参数",
    controlTitle: "控制参数",
    fishGroup: "鱼群",
    playbackAria: "模拟播放控制",
    pause: "暂停",
    resume: "继续",
    step: "单步",
    sardineCount: "沙丁鱼数量",
    koiCount: "锦鲤数量",
    clownfishCount: "小丑鱼数量",
    perception: "感知范围",
    sardineSpeed: "沙丁鱼速度",
    separation: "分离强度",
    avoidance: "避障强度",
    turnRate: "转向速度",
    topMargin: "顶部回避",
    koiGroup: "锦鲤",
    koiPerception: "锦鲤感知范围",
    koiSpeed: "锦鲤速度",
    koiSeparation: "锦鲤分离强度",
    koiAvoidance: "锦鲤避障强度",
    koiTurnRate: "锦鲤转向速度",
    koiTopMargin: "锦鲤顶部回避",
    waterGroup: "水面",
    waterForce: "水波强度",
    waterRadius: "波源半径",
    waterHeight: "波面高度",
    waterPersistence: "余波持久",
    surfaceBand: "触发表层",
    sceneGroup: "画面",
    coralCount: "珊瑚数量",
    coralScale: "珊瑚大小",
    light: "光照",
    cameraAria: "相机控制",
    copyCamera: "复制相机参数",
    copySuccess: "已复制相机参数",
    copyFailed: "复制失败",
  },
  en: {
    title: "Ripple Aquarium",
    topLinksAria: "Project links",
    languageAria: "Language switcher",
    repoTitle: "View project on GitHub",
    repoAria: "View Ripple Aquarium source code on GitHub",
    loadingAria: "Loading fish models",
    loading: "Loading..",
    controlsAria: "Aquarium controls",
    hideParams: "Hide Controls",
    showParams: "Show Controls",
    controlTitle: "Controls",
    fishGroup: "Fish",
    playbackAria: "Simulation playback controls",
    pause: "Pause",
    resume: "Resume",
    step: "Step",
    sardineCount: "Sardines",
    koiCount: "Koi",
    clownfishCount: "Clownfish",
    perception: "Perception",
    sardineSpeed: "Sardine Speed",
    separation: "Separation",
    avoidance: "Avoidance",
    turnRate: "Turn Rate",
    topMargin: "Top Avoidance",
    koiGroup: "Koi",
    koiPerception: "Koi Perception",
    koiSpeed: "Koi Speed",
    koiSeparation: "Koi Separation",
    koiAvoidance: "Koi Avoidance",
    koiTurnRate: "Koi Turn Rate",
    koiTopMargin: "Koi Top Avoid",
    waterGroup: "Water",
    waterForce: "Ripple Force",
    waterRadius: "Source Radius",
    waterHeight: "Wave Height",
    waterPersistence: "Persistence",
    surfaceBand: "Surface Band",
    sceneGroup: "Scene",
    coralCount: "Corals",
    coralScale: "Coral Scale",
    light: "Lighting",
    cameraAria: "Camera controls",
    copyCamera: "Copy Camera",
    copySuccess: "Camera copied",
    copyFailed: "Copy failed",
  },
};

let currentLanguage = readInitialLanguage();

export function t(key) {
  return translations[currentLanguage]?.[key] ?? translations.zh[key] ?? key;
}

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(language) {
  if (!translations[language]) return false;

  currentLanguage = language;
  localStorage.setItem(STORAGE_KEY, language);
  return true;
}

export function applyTranslations(root = document) {
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.title = t("title");

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    setElementText(element, t(element.dataset.i18n));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function setElementText(element, text) {
  if (element.tagName === "LABEL") {
    const textNode = Array.from(element.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim(),
    );
    if (textNode) {
      textNode.nodeValue = `\n          ${text}\n          `;
      return;
    }
  }

  element.textContent = text;
}

function readInitialLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (translations[saved]) return saved;

  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}
