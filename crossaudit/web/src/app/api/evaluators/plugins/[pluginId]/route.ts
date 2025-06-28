import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { pluginManager } from '@/evaluators/plugin-framework';

// GET /api/evaluators/plugins/[pluginId] - Get plugin details
export const GET = withPermission('evaluators.read')(async (request) => {
  try {
    const pluginId = request.url.split('/').pop();
    
    if (!pluginId) {
      return NextResponse.json({ error: 'Plugin ID required' }, { status: 400 });
    }

    const plugin = pluginManager.getPluginInfo(pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Get evaluator runtime info
    const evaluators = plugin.evaluators.map(config => {
      const evaluator = pluginManager.getEvaluator(config.id);
      return {
        config,
        status: evaluator ? 'loaded' : 'not_loaded',
        lastUsed: null // Would track in production
      };
    });

    return NextResponse.json({
      success: true,
      plugin: {
        ...plugin,
        evaluators,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Get plugin details error:', error);
    return NextResponse.json({ error: 'Failed to fetch plugin details' }, { status: 500 });
  }
});