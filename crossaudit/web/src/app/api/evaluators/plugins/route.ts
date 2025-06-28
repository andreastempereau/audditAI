import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { pluginManager, PluginManifest } from '@/evaluators/plugin-framework';

// GET /api/evaluators/plugins - List all plugins
export const GET = withPermission('evaluators.read')(async (request) => {
  try {
    const plugins = pluginManager.getAllPlugins();
    const evaluators = pluginManager.getAllEvaluators();

    const pluginsWithStatus = plugins.map(plugin => {
      const pluginEvaluators = evaluators.filter(evaluator => 
        plugin.evaluators.some(config => config.id === evaluator['config'].id)
      );

      return {
        ...plugin,
        status: 'active',
        evaluatorCount: pluginEvaluators.length,
        activeEvaluators: pluginEvaluators.filter(e => e['config'].enabled).length
      };
    });

    return NextResponse.json({
      success: true,
      plugins: pluginsWithStatus,
      totalPlugins: plugins.length,
      totalEvaluators: evaluators.length
    });

  } catch (error) {
    console.error('Get plugins error:', error);
    return NextResponse.json({ error: 'Failed to fetch plugins' }, { status: 500 });
  }
});

// POST /api/evaluators/plugins - Install a new plugin
export const POST = withPermission('evaluators.write')(async (request) => {
  try {
    const body = await request.json();
    const { manifest, code } = body;

    if (!manifest || !code) {
      return NextResponse.json({ 
        error: 'Plugin manifest and code are required' 
      }, { status: 400 });
    }

    // Validate manifest structure
    const requiredFields = ['id', 'name', 'version', 'description', 'author', 'license'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}` 
        }, { status: 400 });
      }
    }

    // Check if plugin already exists
    const existingPlugin = pluginManager.getPluginInfo(manifest.id);
    if (existingPlugin) {
      return NextResponse.json({ 
        error: 'Plugin with this ID already exists' 
      }, { status: 409 });
    }

    await pluginManager.loadPlugin(manifest, code);

    return NextResponse.json({
      success: true,
      message: 'Plugin installed successfully',
      plugin: manifest
    }, { status: 201 });

  } catch (error) {
    console.error('Install plugin error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to install plugin' 
    }, { status: 500 });
  }
});

// DELETE /api/evaluators/plugins - Uninstall a plugin
export const DELETE = withPermission('evaluators.write')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('id');

    if (!pluginId) {
      return NextResponse.json({ error: 'Plugin ID required' }, { status: 400 });
    }

    const plugin = pluginManager.getPluginInfo(pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    await pluginManager.unloadPlugin(pluginId);

    return NextResponse.json({
      success: true,
      message: 'Plugin uninstalled successfully'
    });

  } catch (error) {
    console.error('Uninstall plugin error:', error);
    return NextResponse.json({ error: 'Failed to uninstall plugin' }, { status: 500 });
  }
});