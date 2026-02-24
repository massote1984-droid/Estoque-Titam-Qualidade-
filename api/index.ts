import appPromise from '../server';

export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    if (!app) {
      return res.status(500).json({ error: "Server failed to start (app is null). Check server logs." });
    }
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Invocation Error:", err);
    return res.status(500).json({ 
      error: "Vercel Invocation Error", 
      message: err.message,
      stack: err.stack 
    });
  }
};
