"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ArrowUpDown, ExternalLink, FileText, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { useDataRoomFragments } from '@/lib/hooks/useDataRoom';
import { Fragment } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FragmentsTabProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function FragmentsTab({ searchQuery, onSearchChange }: FragmentsTabProps) {
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'file'>('relevance');
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: fragments, isLoading, error } = useDataRoomFragments({
    search: searchQuery,
    sortBy,
    confidence: filterBy === 'all' ? undefined : filterBy,
  });

  // Focus search on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const getConfidenceColor = (confidence: Fragment['confidence']) => {
    switch (confidence) {
      case 'high':
        return 'text-success-600 bg-success-50 dark:bg-success-900/20';
      case 'medium':
        return 'text-warning-600 bg-warning-50 dark:bg-warning-900/20';
      case 'low':
        return 'text-muted-600 bg-muted-50 dark:bg-muted-800';
    }
  };

  const highlightSearchTerm = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/20 text-primary-900 dark:text-primary-100">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search fragments with semantic AI..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-4"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => onSearchChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="flex items-center gap-4 p-4 bg-muted-50 dark:bg-muted-900 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-700 dark:text-muted-300">
                Sort by:
              </label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Date Modified</SelectItem>
                  <SelectItem value="file">File Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-700 dark:text-muted-300">
                Confidence:
              </label>
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as any)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="high">High Confidence</SelectItem>
                  <SelectItem value="medium">Medium Confidence</SelectItem>
                  <SelectItem value="low">Low Confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {searchQuery && (
          <div className="flex items-center justify-between text-sm text-muted-600">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {isLoading ? (
                'Searching with AI...'
              ) : fragments?.length ? (
                `Found ${fragments.length} fragment${fragments.length === 1 ? '' : 's'} for "${searchQuery}"`
              ) : (
                `No fragments found for "${searchQuery}"`
              )}
            </div>
            
            {fragments?.length && (
              <Button variant="ghost" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                {sortBy === 'relevance' ? 'Most Relevant' : sortBy === 'date' ? 'Latest First' : 'A-Z'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results Grid */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-muted-200 dark:bg-muted-800 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12 text-center">
          <div className="space-y-2">
            <p className="text-error-600">Failed to search fragments</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !error && searchQuery && fragments?.length === 0 && (
        <div className="flex items-center justify-center py-12 text-center">
          <div className="space-y-2">
            <Search className="h-12 w-12 text-muted-400 mx-auto" />
            <h3 className="font-medium text-muted-900 dark:text-white">No fragments found</h3>
            <p className="text-sm text-muted-600">
              Try adjusting your search terms or filters
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && fragments && fragments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fragments.map((fragment) => (
            <div
              key={fragment.id}
              className="group relative border border-muted-200 dark:border-muted-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                // TODO: Open fragment detail modal
                console.log('Open fragment:', fragment.id);
              }}
            >
              {/* Fragment Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{fragment.fileName}</p>
                    <p className="text-xs text-muted-600">
                      Page {fragment.page} • Line {fragment.lineStart}-{fragment.lineEnd}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    getConfidenceColor(fragment.confidence)
                  )}>
                    {fragment.confidence} conf.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open file at fragment location
                      console.log('Open file at fragment:', fragment.id);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Fragment Content */}
              <div className="space-y-2">
                <p className="text-sm text-muted-900 dark:text-white line-clamp-3">
                  {highlightSearchTerm(fragment.content, searchQuery)}
                </p>
                
                {fragment.context && (
                  <p className="text-xs text-muted-600 line-clamp-2">
                    Context: {fragment.context}
                  </p>
                )}
              </div>

              {/* Fragment Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-muted-100 dark:border-muted-800">
                <div className="flex items-center gap-2 text-xs text-muted-600">
                  <span>Score: {fragment.score.toFixed(2)}</span>
                  {fragment.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{fragment.tags.slice(0, 2).join(', ')}</span>
                      {fragment.tags.length > 2 && (
                        <span>+{fragment.tags.length - 2} more</span>
                      )}
                    </>
                  )}
                </div>
                
                <time className="text-xs text-muted-600">
                  {new Date(fragment.lastModified).toLocaleDateString()}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !searchQuery && (
        <div className="flex items-center justify-center py-12 text-center">
          <div className="space-y-4 max-w-md">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl flex items-center justify-center">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-muted-900 dark:text-white">
                Search Document Fragments
              </h3>
              <p className="text-sm text-muted-600">
                Use AI-powered semantic search to find relevant content across all your documents.
                Search by concepts, not just keywords.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['financial data', 'compliance requirements', 'risk assessment', 'policy changes'].map((term) => (
                <Button
                  key={term}
                  variant="secondary"
                  size="sm"
                  onClick={() => onSearchChange(term)}
                  className="text-xs"
                >
                  {term}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}