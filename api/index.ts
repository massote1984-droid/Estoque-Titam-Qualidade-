import appPromise from '../server';

export default async (req: any, res: any) => {
  try {
    console.log("Vercel Function Invoked:", req.method, req.url);
    const app = await appPromise;
    if (!app) {
      console.error("App initialization failed: appPromise resolved to null");
      return res.status(500).json({ 
        error: "Server failed to start", 
        details: "appPromise resolved to null. This usually means a critical error occurred during startServer()." 
      });
    }
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Invocation Error:", err);
    return res.status(500).json({ 
      error: "Vercel Invocation Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
