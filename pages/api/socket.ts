// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiRequest, NextApiResponse } from "next";

interface Request extends NextApiRequest {
  context: {
    io: SocketIO.Server;
  };
}

let activeSockets = new Set();

export default (req: Request, res: NextApiResponse) => {
  const io = req.context.io;

  io.on("connection", (socket) => {
    activeSockets.add(socket.id);

    socket.emit("user-list", Array.from(activeSockets));
    socket.broadcast.emit("user-list", Array.from(activeSockets));

    socket.once("disconnect", () => {
      activeSockets.delete(socket.id);

      socket.emit("user-list", Array.from(activeSockets));
      socket.broadcast.emit("user-list", Array.from(activeSockets));
    });
  });

  res.statusCode = 200;
  res.json({});
};
