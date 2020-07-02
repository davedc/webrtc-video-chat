import Head from "next/head";
import { useEffect, useState, useRef, VideoHTMLAttributes } from "react";
import io from "socket.io-client";
import {
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Fab,
  GridList,
  GridListTile,
} from "@material-ui/core";
import { UserMediaError, useUserMedia } from "@vardius/react-user-media";
import Peer from "peerjs";

type PropsType = VideoHTMLAttributes<HTMLVideoElement> & {
  srcObject: MediaStream;
};

function Video({ srcObject, ...props }: PropsType) {
  const refVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!refVideo.current) return;
    refVideo.current.srcObject = srcObject;
  }, [srcObject]);

  return <video ref={refVideo} {...props} />;
}

interface Streams {
  [key: string]: {
    stream: MediaStream;
  };
}

interface Calls {
  [key: string]: {
    call: Peer.MediaConnection;
  };
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
  const [userList, setUserList] = useState<string[]>([]);
  const [id, setId] = useState<string>("");
  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [calls, setCalls] = useState<Calls>({});
  const [streams, setStreams] = useState<Streams>({});
  const { stream } = useUserMedia({ audio: true, video: true });

  useEffect(() => {
    fetch("/api/socket").finally(() => {
      const ws = io();

      ws.on("connect", () => {
        setIsConnected(true);
        setSocket(ws);
        setId(ws.id);
      });

      ws.on("user-list", (users: string[]) => {
        setUserList(users);
      });
    });

    return () => {
      socket?.disconnect();
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    const peer = new Peer(id);
    setPeerInstance(peer);

    return () => {
      peer.destroy();
      setPeerInstance(null);
    };
  }, [id]);

  useEffect(() => {
    if (peerInstance && stream) {
      peerInstance.on("call", (call) => {
        call.answer(stream);

        call.on("stream", (s) => {
          setCalls({ [call.peer]: { call }, ...calls });
          setStreams({ [call.peer]: { stream: s }, ...streams });
        });

        call.on("close", () => {
          const { [call.peer]: _, ...restOfCalls } = calls;
          setCalls(restOfCalls);

          const { [call.peer]: __, ...restOfStreams } = streams;
          setStreams(restOfStreams);
        });
      });
    }
  }, [peerInstance, stream]);

  useEffect(() => {
    const unconnectedPeers = userList.filter((u) => u !== id && !calls[u]);

    console.log("userList", userList);
    console.log("unconnected", unconnectedPeers);
    console.log("streams", streams);
    console.log("calls", calls);

    if (stream && peerInstance && unconnectedPeers.length > 0) {
      setCalls({
        ...calls,
        ...unconnectedPeers.reduce<Calls>((acc, u) => {
          if (calls[u]?.call) {
            return acc;
          }

          const call = peerInstance.call(u, stream);

          call.on("stream", (s) => {
            setStreams({ ...streams, [call.peer]: { stream: s } });
          });

          call.on("close", () => {
            const { [call.peer]: _, ...rest } = streams;
            setStreams(rest);
          });

          return { ...acc, [call.peer]: { call } };
        }, {}),
      });
    }
  }, [peerInstance, id, userList, stream]);

  return (
    <>
      <Head>
        <title>Video Chat with webRTC</title>
      </Head>

      <Grid container>
        <Grid item xs={12} sm={3}>
          <List color="primary">
            <ListItem>
              <ListItemText>Connected Users:</ListItemText>
            </ListItem>
            <Divider />
            {userList.map((u) => (
              <ListItem key={u}>
                <ListItemText>{`${u}${id === u ? " - You" : ""}`}</ListItemText>
              </ListItem>
            ))}
          </List>
        </Grid>
        <Grid item xs={12} sm={9}>
          <GridList cellHeight={400} cols={3}>
            <GridListTile>
              {stream && (
                <Video autoPlay srcObject={stream} height={400} muted={true} />
              )}
            </GridListTile>
            {Object.entries(streams).map(
              ([id, s]) =>
                s.stream && (
                  <GridListTile key={id}>
                    <Video autoPlay srcObject={s.stream} height={400} />
                  </GridListTile>
                )
            )}
          </GridList>
        </Grid>
      </Grid>
      <Fab
        variant="extended"
        color="default"
        style={{ left: "20px", bottom: "20px", position: "absolute" }}
      >
        {isConnected ? "Connected to server" : "Connecting"}
      </Fab>
    </>
  );
}
