import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { themePresets, templatePresets, ThemePreset, TemplatePreset } from '@/lib/themePresets';

interface ThemeContextType {
  activeTheme: string;
  activeTemplate: string;
  platformName: string;
  invoiceName: string;
  setTheme: (themeId: string) => Promise<void>;
  setTemplate: (templateId: string) => Promise<void>;
  setPlatformName: (name: string) => Promise<void>;
  setInvoiceName: (name: string) => Promise<void>;
  currentTheme: ThemePreset | undefined;
  currentTemplate: TemplatePreset | undefined;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const applyTheme = (theme: ThemePreset) => {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const vars = isDark ? theme.dark : theme.light;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [activeTheme, setActiveTheme] = useState('blue-default');
  const [activeTemplate, setActiveTemplate] = useState('classic');
  const [platformName, setPlatformNameState] = useState('Family Fashion');
  const [invoiceName, setInvoiceNameState] = useState('Family Fashion');

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('active_theme, active_template, platform_name, invoice_name')
        .eq('id', 'main')
        .maybeSingle();

      if (data) {
        setActiveTheme(data.active_theme);
        setActiveTemplate(data.active_template);
        setPlatformNameState((data as any).platform_name || 'Family Fashion');
        setInvoiceNameState((data as any).invoice_name || 'Family Fashion');
        const theme = themePresets.find(t => t.id === data.active_theme);
        if (theme) applyTheme(theme);
      }
    };
    fetchSettings();

    const channel = supabase
      .channel('app-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const newData = payload.new as any;
        if (newData) {
          setActiveTheme(newData.active_theme);
          setActiveTemplate(newData.active_template);
          setPlatformNameState(newData.platform_name || 'Family Fashion');
          setInvoiceNameState(newData.invoice_name || 'Family Fashion');
          const theme = themePresets.find(t => t.id === newData.active_theme);
          if (theme) applyTheme(theme);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const theme = themePresets.find(t => t.id === activeTheme);
    if (theme) applyTheme(theme);
  }, [activeTheme]);

  const setTheme = async (themeId: string) => {
    setActiveTheme(themeId);
    const theme = themePresets.find(t => t.id === themeId);
    if (theme) applyTheme(theme);
    await supabase.from('app_settings').update({ active_theme: themeId, updated_at: new Date().toISOString() }).eq('id', 'main');
  };

  const setTemplate = async (templateId: string) => {
    setActiveTemplate(templateId);
    await supabase.from('app_settings').update({ active_template: templateId, updated_at: new Date().toISOString() }).eq('id', 'main');
  };

  const setPlatformName = async (name: string) => {
    setPlatformNameState(name);
    await supabase.from('app_settings').update({ platform_name: name, updated_at: new Date().toISOString() } as any).eq('id', 'main');
  };

  const setInvoiceName = async (name: string) => {
    setInvoiceNameState(name);
    await supabase.from('app_settings').update({ invoice_name: name, updated_at: new Date().toISOString() } as any).eq('id', 'main');
  };

  return (
    <ThemeContext.Provider value={{
      activeTheme, activeTemplate, platformName, invoiceName,
      setTheme, setTemplate, setPlatformName, setInvoiceName,
      currentTheme: themePresets.find(t => t.id === activeTheme),
      currentTemplate: templatePresets.find(t => t.id === activeTemplate),
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
