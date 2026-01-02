import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages } from '../i18n';

export default function LanguageSelector({ compact = false }) {
  const { i18n } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    setShowMenu(false);
  };

  const styles = {
    container: {
      position: 'relative',
    },
    button: {
      padding: compact ? '6px 10px' : '8px 12px',
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: compact ? '12px' : '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    menu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '4px',
      background: '#1a1a2e',
      border: '1px solid #333',
      borderRadius: '6px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 1000,
      minWidth: '150px',
      maxHeight: '300px',
      overflowY: 'auto',
    },
    option: {
      display: 'block',
      width: '100%',
      padding: '10px 15px',
      background: 'transparent',
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '13px',
    },
    optionActive: {
      display: 'block',
      width: '100%',
      padding: '10px 15px',
      background: 'rgba(0,212,255,0.2)',
      border: 'none',
      color: '#00d4ff',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '13px',
    },
  };

  return (
    <div style={styles.container}>
      <button style={styles.button} onClick={() => setShowMenu(!showMenu)}>
        {currentLang.flag} {compact ? currentLang.code.toUpperCase() : currentLang.name}
      </button>
      {showMenu && (
        <div style={styles.menu}>
          {languages.map(lang => (
            <button
              key={lang.code}
              style={i18n.language === lang.code ? styles.optionActive : styles.option}
              onClick={() => changeLang(lang.code)}
            >
              {lang.flag} {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
