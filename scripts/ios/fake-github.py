# Faux GitHub (API des Gists) pour l'essai dans le simulateur iPhone (scripts/ios-sim-test.sh) : la synchronisation
# du compte est testée sans toucher à un vrai compte. Jeton accepté : ghp_test.
#
# Usage : python3 fake-github.py PORT [GIST.json]   (GIST.json : un Gist de compte déjà là, comme après une
# synchronisation depuis un autre appareil ; GET /__dump renvoie les Gists tels qu'ils sont).
import json, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "ghp_test"
gists = {}
if len(sys.argv) > 2:
    with open(sys.argv[2], encoding="utf-8") as f:
        gists.update(json.load(f))


class H(BaseHTTPRequestHandler):
    def _auth(self):
        if self.headers.get("Authorization") != "Bearer " + TOKEN:
            self._send(401, {"message": "Bad credentials"})
            return False
        return True

    def _send(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        sys.stderr.write("%s %s\n" % (self.command, self.path))
        sys.stderr.flush()

    def do_GET(self):
        if self.path == "/__dump":
            return self._send(200, gists)
        if not self._auth():
            return
        if self.path == "/user":
            return self._send(200, {"login": "testeur"})
        if self.path.startswith("/gists?"):
            return self._send(200, [{"id": k, "description": g["description"], "updated_at": g["updated_at"]} for k, g in gists.items()])
        if self.path.startswith("/gists/"):
            g = gists.get(self.path.split("/")[2])
            if not g:
                return self._send(404, {"message": "Not Found"})
            return self._send(200, {"id": self.path.split("/")[2], "description": g["description"],
                                    "files": {n: {"content": c, "truncated": False} for n, c in g["files"].items()}})
        self._send(404, {})

    def do_POST(self):
        if not self._auth():
            return
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n))
        gid = uuid.uuid4().hex
        gists[gid] = {"description": data["description"],
                      "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S") + ".%06dZ" % (time.time() % 1 * 1e6),
                      "files": {k: v["content"] for k, v in data["files"].items()}}
        self._send(201, {"id": gid})

    def do_DELETE(self):
        if not self._auth():
            return
        gists.pop(self.path.split("/")[2], None)
        self.send_response(204)
        self.end_headers()


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
