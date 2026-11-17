'use strict';

const indexTranslations = {
  nl: {
    browserTitle: 'Vivium dashboards',
    languageLabel: 'Taal / Langue',
    introLabel: 'Vivium dashboards',
    pageTitle: 'Van cijfers naar helder inzicht',
    introText: 'Kies het dashboard dat je wilt openen.',
    navigationLabel: 'Dashboards',
    nonLifeLabel: 'Dashboard kerncijfers non-life',
    lifeLabel: 'Dashboard kerncijfers life',
    rappelLabel: 'Dashboard rappelcijfers life',
    footerText: 'Ontwikkeld door Hans von der Crone - data wordt niet online bewaard'
  },
  fr: {
    browserTitle: 'Tableaux de bord Vivium',
    languageLabel: 'Langue',
    introLabel: 'Tableaux de bord Vivium',
    pageTitle: 'Des chiffres à une vision claire',
    introText: 'Choisissez le tableau de bord que vous souhaitez ouvrir.',
    navigationLabel: 'Tableaux de bord',
    nonLifeLabel: 'Tableau de bord chiffres clés non-vie',
    lifeLabel: 'Tableau de bord chiffres clés vie',
    rappelLabel: 'Tableau de bord chiffres de rappel vie',
    footerText: 'Développé par Hans von der Crone - les données ne sont pas conservées en ligne'
  }
};

const indexLanguageSelect = document.getElementById('languageSelect');

function setIndexLanguage(language) {
  const translations = indexTranslations[language] || indexTranslations.nl;
  document.documentElement.lang = language === 'fr' ? 'fr' : 'nl';
  document.title = translations.browserTitle;
  document.getElementById('dashboardNavigation').setAttribute('aria-label', translations.navigationLabel);
  for (const id of ['languageLabel', 'introLabel', 'pageTitle', 'introText', 'nonLifeLabel', 'lifeLabel', 'rappelLabel', 'footerText']) {
    document.getElementById(id).textContent = translations[id];
  }
}

indexLanguageSelect.addEventListener('change', event => setIndexLanguage(event.target.value));
setIndexLanguage(indexLanguageSelect.value);
