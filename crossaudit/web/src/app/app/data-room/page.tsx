"use client";
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Files, Search, History, Settings as SettingsIcon } from 'lucide-react';
import { FilesTab } from '@/components/dataroom/FilesTab';
import { FragmentsTab } from '@/components/dataroom/FragmentsTab';
import { VersionsTab } from '@/components/dataroom/VersionsTab';
import { SettingsTab } from '@/components/dataroom/SettingsTab';
import { IndexHealthCard } from '@/components/dataroom/IndexHealthCard';
import { useIndexHealth } from '@/lib/hooks/useDataRoom';

export default function DataRoom() {
  const [activeTab, setActiveTab] = useState('files');
  const [searchQuery, setSearchQuery] = useState('');
  const { health } = useIndexHealth();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('fragments');
        // Focus search bar after tab switch
        setTimeout(() => {
          const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
          searchInput?.focus();
        }, 100);
      }

      if (e.key === 'u' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('files');
        // Trigger upload zone
        setTimeout(() => {
          const uploadZone = document.querySelector('[data-upload-zone]') as HTMLElement;
          uploadZone?.click();
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Index Health */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display-xl text-muted-900 dark:text-white">Data Room</h1>
          <p className="text-sm text-muted-600 dark:text-muted-400 mt-1">
            Manage files, search fragments, and track versions
          </p>
        </div>
        <IndexHealthCard health={health} />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Files className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="fragments" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Fragments
            </TabsTrigger>
            <TabsTrigger value="versions" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <TabsContent value="files" className="h-full mt-0">
              <FilesTab />
            </TabsContent>

            <TabsContent value="fragments" className="h-full mt-0">
              <FragmentsTab searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            </TabsContent>

            <TabsContent value="versions" className="h-full mt-0">
              <VersionsTab />
            </TabsContent>

            <TabsContent value="settings" className="h-full mt-0">
              <SettingsTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
