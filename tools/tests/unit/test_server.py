"""Unit tests of the server's own logic (no Forge, no browser): `python -m unittest discover -s tools/tests/unit`."""

import json
import os
import struct
import tempfile
import time
import unittest
import zlib
from pathlib import Path
from typing import ClassVar

from server import images, library, naming, timings
from server.backends.forge import bare, lora_folders, same_paths
from server.config import Paths, load_config
from server.errors import ApiError
from server.instance import InstanceLock, bind_first, read_instance, write_instance
from server.jobqueue import JobQueue, public
from server.launch import browser_command, find_browser, profile_dir, running_port
from server.lifecycle import window_gone
from server.page import build_page, styles_signature
from server.pictures import Pictures
from server.store import Store
from server.updates import version_key


def tiny_png() -> bytes:
    """A valid one-pixel PNG."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return (
        images.PNG_SIGNATURE + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"\0\0\0\0")) + chunk(b"IEND", b"")
    )


class TempDirs(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.paths = Paths(root, root / "out", root / "data")
        self.paths.make_dirs()

    def tearDown(self) -> None:
        Store.close_all()  # Windows won't delete a folder with an open database in it
        self._tmp.cleanup()


class Images(unittest.TestCase):
    def test_text_round_trip(self) -> None:
        png = tiny_png()
        self.assertFalse(images.has_text(png, "parameters"))
        with_text = images.add_text(png, "parameters", "a cup, Steps: 8 — ünïcode")
        self.assertTrue(images.has_text(with_text, "parameters"))
        self.assertTrue(with_text.endswith(png[-12:]), "IEND stays last")
        self.assertEqual(images.drop_text(with_text, "parameters"), png)

    def test_drop_keeps_other_keys(self) -> None:
        png = images.add_text(images.add_text(tiny_png(), "parameters", "p"), "kiln_name", "Series")
        dropped = images.drop_text(png, "kiln_name")
        self.assertTrue(images.has_text(dropped, "parameters"))
        self.assertFalse(images.has_text(dropped, "kiln_name"))

    def test_image_type(self) -> None:
        self.assertEqual(images.image_type(tiny_png()), "image/png")
        self.assertEqual(images.image_type(b"\xff\xd8\xff\xe0"), "image/jpeg")
        self.assertEqual(images.image_type(b"RIFF\0\0\0\0WEBPVP8 "), "image/webp")
        self.assertEqual(images.image_type(b"nope"), "application/octet-stream")


class Naming(TempDirs):
    def name(self, series: str, files: list[str] | None = None, take: bool = False) -> str:
        return naming.next_filename(
            series, 42, out_dir=self.paths.out, job_files=files or [], names=Store.open(self.paths), take=take
        )

    def test_slugify(self) -> None:
        self.assertEqual(naming.slugify("Red Cup / v2!"), "red-cup-v2")
        self.assertEqual(naming.slugify("Чашка чая"), "чашка-чая")
        self.assertEqual(naming.slugify("!!!"), "kiln")
        self.assertEqual(len(naming.slugify("x" * 100)), 60)

    def test_numbers_go_up_and_gaps_stay(self) -> None:
        self.assertEqual(self.name("Cup"), "cup-001.png")
        (self.paths.out / "cup-001.png").touch()
        (self.paths.out / "cup-003.png").touch()
        self.assertEqual(self.name("Cup"), "cup-004.png")
        self.assertEqual(self.name("Cup", ["cup-007.png"]), "cup-008.png", "files the queue knows count too")

    def test_a_deleted_number_is_never_reused(self) -> None:
        self.assertEqual(self.name("Cup", take=True), "cup-001.png")
        self.assertEqual(self.name("Cup", take=True), "cup-002.png")  # nothing on disk: the high-water mark counts
        self.assertEqual(Store.open(self.paths).get("names"), {"cup": 2})
        self.assertEqual(self.name("Cup"), "cup-003.png")
        self.assertEqual(self.name("Cup"), "cup-003.png", "without take, nothing is recorded")

    def test_no_series(self) -> None:
        self.assertRegex(self.name("  "), r"^kiln-\d{8}-\d{6}-42\.png$")


class Timings(unittest.TestCase):
    def run_of(self, w: int, h: int, steps: int, dur: float, first: float | None = None) -> dict:
        return {"w": w, "h": h, "steps": steps, "mp": timings.mp_bucket(w, h), "dur": dur, "first": first}

    def test_mp_bucket_and_median(self) -> None:
        self.assertEqual(timings.mp_bucket(1024, 1024), "1.0")
        self.assertEqual(timings.mp_bucket(1536, 1024), "1.5")
        self.assertEqual(timings.mp_bucket(640, 640), "0.5")
        self.assertEqual(timings.median([3, 1, 2]), 2)
        self.assertEqual(timings.median([4, 1, 2, 3]), 2.5)

    def test_same_size_and_steps_first(self) -> None:
        hist = [self.run_of(1024, 1024, 8, d, 20) for d in (100, 1000, 110, 120, 130, 140)]  # the last five count
        self.assertEqual(timings.estimate_from(hist, {}, {"w": 1024, "h": 1024, "steps": 8}), (130, 20))

    def test_same_megapixels_other_steps(self) -> None:
        hist = [self.run_of(1024, 1024, 10, 100)]
        self.assertEqual(timings.estimate_from(hist, {}, {"w": 1024, "h": 1024, "steps": 4}), (40, None))

    def test_nothing_measured(self) -> None:
        self.assertEqual(timings.estimate_from([], {"1.0": 5}, {"w": 1024, "h": 1024, "steps": 4}), (20, None))
        self.assertEqual(timings.estimate_from([], {}, {"w": 1024, "h": 1024, "steps": 2}), (120, None))

    def test_setup_ignores_lora_order(self) -> None:
        a = {"w": 1, "h": 1, "loras": [{"name": "a", "w": 1}, {"name": "b", "w": 0.5}]}
        b = {"w": 1, "h": 1, "loras": [{"name": "b", "w": "0.5"}, {"name": "a", "w": 1.0}]}
        self.assertEqual(timings.setup_of(a), timings.setup_of(b))


class Queue(TempDirs):
    def test_load_runs_a_crashed_job_again(self) -> None:
        self.paths.queue_file.write_text(json.dumps([{"id": 1, "status": "running", "step": 5, "progress": 0.5}]))
        q = JobQueue(self.paths)
        q.load()
        self.assertEqual(q.jobs[0]["status"], "pending")
        self.assertEqual(q.jobs[0]["step"], 0)

    def test_unreadable_queue_starts_empty(self) -> None:
        self.paths.queue_file.write_text("{ broken")
        with self.assertLogs("kiln", "WARNING"):
            q = JobQueue(self.paths)  # the one-time import of the old JSON files
        q.load()
        self.assertEqual(q.jobs, [])

    def test_ids_are_never_reused(self) -> None:
        q = JobQueue(self.paths)
        a, b = q.add([{"steps": 4}, {"steps": 4}])
        q.keep_only(lambda j: False)
        (c,) = q.add([{"steps": 4}])
        self.assertEqual((a, b, c), (1, 2, 3))

    def test_every_change_changes_the_signature(self) -> None:
        q = JobQueue(self.paths)
        s0 = q.signature()
        q.add([{"steps": 4}])
        s1 = q.signature()
        q.set_paused(True)
        self.assertEqual(len({s0, s1, q.signature()}), 3)

    def test_pause_holds_the_next_job(self) -> None:
        q = JobQueue(self.paths)
        q.add([{"steps": 4}])
        q.set_paused(True)
        self.assertIsNone(q.next_pending())
        q.set_paused(False)
        self.assertIsNotNone(q.next_pending())

    def test_reorder_moves_only_waiting_jobs(self) -> None:
        q = JobQueue(self.paths)
        ids = q.add([{"steps": 1}, {"steps": 1}, {"steps": 1}])
        q.jobs[0]["status"] = "done"
        q.reorder([ids[2], 999])
        self.assertEqual([j["id"] for j in q.jobs], [ids[0], ids[2], ids[1]])

    def test_upscale_jumps_the_line(self) -> None:
        q = JobQueue(self.paths)
        ids = q.add([{"steps": 1, "w": 64, "h": 64}, {"steps": 1}])
        q.jobs[0].update(status="done", file="a-001.png")
        up = q.add_upscale(q.jobs[0], "R-ESRGAN", 2)
        self.assertEqual([j["id"] for j in q.jobs], [ids[0], up, ids[1]])

    def test_the_list_is_kept_in_the_database(self) -> None:
        q = JobQueue(self.paths)
        a, b = q.add([{"steps": 1}, {"steps": 1}])
        q.jobs[0]["status"] = "done"
        q.save()
        Store.close_all()  # as after a restart
        q2 = JobQueue(self.paths)
        q2.load()
        self.assertEqual([(j["id"], j["status"]) for j in q2.jobs], [(a, "done"), (b, "pending")])
        self.assertTrue(self.paths.db_file.exists())
        self.assertFalse(self.paths.queue_file.exists())

    def test_a_save_writes_only_what_changed(self) -> None:
        q = JobQueue(self.paths)
        q.add([{"steps": 1}] * 3)
        con = q.store.con
        before = con.total_changes
        q.jobs[1]["status"] = "done"
        q.save()
        self.assertEqual(con.total_changes - before, 1)  # one row, not the whole list

    def test_old_json_files_are_imported_once_and_kept(self) -> None:
        self.paths.queue_file.write_bytes(b"")  # 2026-10-27: a crash had left queue.json empty…
        bak = self.paths.queue_file.with_name("queue.json.bak")
        bak.write_text(json.dumps([{"id": 7, "status": "done"}]))  # …and the previous list was kept
        self.paths.ids_file.write_text(json.dumps({"high": 9}))
        self.paths.names_file.write_text(json.dumps({"cup": 3}))
        with self.assertLogs("kiln", "WARNING"):
            q = JobQueue(self.paths)
        q.load()
        self.assertEqual([j["id"] for j in q.jobs], [7])
        self.assertEqual(q.next_id(), 10)
        self.assertEqual(q.store.get("names"), {"cup": 3})
        legacy = sorted(p.name for p in (self.paths.data / "legacy-json").iterdir())
        self.assertEqual(legacy, ["ids.json", "names.json", "queue.json", "queue.json.bak"])  # kept, not deleted
        self.assertFalse(self.paths.queue_file.exists())

    def test_clear_list_then_undo(self) -> None:
        q = JobQueue(self.paths)
        a, b, c, d = q.add([{"steps": 1}] * 4)
        q.jobs[0]["status"] = "done"
        q.jobs[1]["status"] = "error"
        q.jobs[2]["status"] = "deleted"  # in Delete's undo window: left to its own timer
        self.assertEqual(q.clear_finished(), 2)
        self.assertEqual([j["id"] for j in q.jobs], [c, d])
        (e,) = q.add([{"steps": 1}])
        self.assertEqual(q.unclear(), 2)
        self.assertEqual([j["id"] for j in q.jobs], [a, b, c, d, e])  # back in place; the new one after
        self.assertEqual(q.unclear(), 0)  # once

    def test_undo_brings_back_only_the_last_clear(self) -> None:
        q = JobQueue(self.paths)
        _a, b = q.add([{"steps": 1}] * 2)
        q.jobs[0]["status"] = "done"
        q.clear_finished()
        q.jobs[0]["status"] = "done"
        q.clear_finished()
        q.unclear()
        self.assertEqual([j["id"] for j in q.jobs], [b])

    def test_public_hides_the_servers_keys(self) -> None:
        self.assertEqual(public({"id": 1, "_cancel": True}), {"id": 1})

    def test_public_list(self) -> None:
        q = JobQueue(self.paths)
        q.add([{"steps": 1, "w": 1, "h": 1}, {"steps": 1}, {"steps": 1}])
        q.jobs[1].update(status="done", file="gone.png")
        q.jobs[2]["status"] = "deleted"
        out = q.public_list(lambda spec: (10.0, None))
        self.assertEqual([j["id"] for j in out], [1, 2])
        self.assertEqual(out[0]["est"], 10.0)
        self.assertTrue(out[1]["missing"])


class PicturesOnDisk(TempDirs):
    def setUp(self) -> None:
        super().setUp()
        self.q = JobQueue(self.paths)
        self.pics = Pictures(self.paths, self.q)
        (jid,) = self.q.add([{"steps": 1, "name": "Cup"}])
        self.jid = jid
        self.q.jobs[0].update(status="done", file="cup-001.png")
        (self.paths.out / "cup-001.png").write_bytes(images.add_text(tiny_png(), "kiln_name", "Cup"))

    def test_delete_then_undo(self) -> None:
        self.pics.act(self.jid, "delete")
        self.assertFalse((self.paths.out / "cup-001.png").exists())
        self.assertTrue((self.paths.trash / "cup-001.png").exists())
        self.pics.act(self.jid, "undelete")
        self.assertTrue((self.paths.out / "cup-001.png").exists())
        self.assertEqual(self.q.jobs[0]["status"], "done")

    def test_finish_delete_takes_it_off_the_list(self) -> None:
        self.pics.act(self.jid, "delete")
        self.pics.finish_delete(self.jid)
        self.assertEqual(self.q.jobs, [])

    def test_actions_it_wont_take(self) -> None:
        with self.assertRaises(ApiError) as e:
            self.pics.act(999, "delete")
        self.assertEqual(e.exception.status, 404)
        with self.assertRaises(ApiError) as e:
            self.pics.act(self.jid, "name", "x")  # only a waiting job's series can change
        self.assertEqual((e.exception.status, e.exception.message), (409, "can't name a done job"))

    def test_rename_joins_the_series_and_rewrites_the_name_inside(self) -> None:
        res = self.pics.rename(self.jid, "Tea", "")
        self.assertEqual(res, {"file": "tea-001.png", "old": "cup-001.png"})
        data = (self.paths.out / "tea-001.png").read_bytes()
        self.assertIn(b"kiln_name\0\0\0\0\0Tea", data)
        self.assertNotIn(b"Cup", data)
        self.assertFalse((self.paths.out / "cup-001.png").exists())
        self.assertEqual(self.pics.rename(self.jid, "Cup", "cup-001.png")["file"], "cup-001.png", "Undo: its own name")

    def test_save_back_puts_the_text_back(self) -> None:
        import base64

        self.q.jobs[0]["infotext"] = "a cup, Steps: 1"
        (self.paths.out / "cup-001.png").unlink()
        url = "data:image/png;base64," + base64.b64encode(tiny_png()).decode()
        self.assertEqual(self.pics.save_back(self.jid, url), {"ok": True})
        data = (self.paths.out / "cup-001.png").read_bytes()
        self.assertTrue(images.has_text(data, "parameters") and images.has_text(data, "kiln_name"))

    def test_tidy_prunes_thumbnails_of_gone_jobs(self) -> None:
        (self.paths.qthumbs / f"{self.jid}.jpg").touch()
        (self.paths.qthumbs / "999.jpg").touch()
        (self.paths.qthumbs / "junk.jpg").touch()
        self.pics.tidy()
        self.assertEqual([p.name for p in self.paths.qthumbs.iterdir()], [f"{self.jid}.jpg"])


class Forge(unittest.TestCase):
    def test_lora_folders(self) -> None:
        paths = [
            Path(p) for p in ("C:/f/models/Lora/a.st", "C:/f/models/Lora/people/b.st", "C:/f/models/Lora/s/x/c.st")
        ]
        self.assertEqual(lora_folders(paths), ["", "people", "s"])

    def test_lora_folders_without_a_lora_folder(self) -> None:
        paths = [Path(p) for p in ("/m/loras/a.st", "/m/loras/style/b.st")]
        self.assertEqual(lora_folders(paths), ["", "style"])

    def test_checkpoint_names(self) -> None:
        self.assertEqual(bare("krea.safetensors [abc123]"), "krea.safetensors")
        self.assertEqual(same_paths(["a/b", "a/./c"]), same_paths(["a/c", "a/b"]))


class Misc(unittest.TestCase):
    def test_window_gone(self) -> None:
        t = 1000.0
        self.assertFalse(window_gone(t, t - 5, None), "polled 5 s ago")
        self.assertTrue(window_gone(t, t - 601, None), "10 min of silence")
        self.assertTrue(window_gone(t, t - 5, t - 4), "goodbye 4 s ago, no poll since")
        self.assertFalse(window_gone(t, t - 1, t - 4), "a poll after the goodbye: a reload")
        self.assertFalse(window_gone(t, t - 5, t - 2), "goodbye only 2 s ago")

    def test_satoshi_installed_or_not(self) -> None:
        import shutil

        repo = Path(__file__).resolve().parents[3]
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            shutil.copy(repo / "index.html", root / "index.html")
            (root / "app").mkdir()
            page = build_page(root).decode()
            self.assertNotIn("satoshi/satoshi.css", page, "not installed: no link to a missing file")
            self.assertIn("Satoshi — not installed", page)
            self.assertIn('value="Satoshi" disabled', page)
            (root / "app" / "fonts" / "satoshi").mkdir(parents=True)
            (root / "app" / "fonts" / "satoshi" / "satoshi.css").write_text("/* */")
            page = build_page(root).decode()
            self.assertIn("satoshi/satoshi.css", page, "installed: as before")
            self.assertIn('<option value="Satoshi">Satoshi</option', page)

    def test_styles_signature_changes_on_save(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            css = Path(d, "app", "styles", "themes")
            css.mkdir(parents=True)
            f = css / "a.css"
            f.write_text("a{}")
            s1 = styles_signature(Path(d), now=100.0)
            self.assertEqual(styles_signature(Path(d), now=100.5), s1, "looked at once a second at most")
            import os

            os.utime(f, ns=(f.stat().st_atime_ns, f.stat().st_mtime_ns + 10**9))
            self.assertNotEqual(styles_signature(Path(d), now=101.5), s1, "a save changes it")
            (css / "b.css").write_text("b{}")
            self.assertTrue(styles_signature(Path(d), now=103.0).startswith("2."), "a new file counts too")

    def test_version_key(self) -> None:
        self.assertEqual(version_key("v0.6"), (0, 6, 0))
        self.assertGreater(version_key("v0.10"), version_key("v0.9.1"))
        self.assertIsNone(version_key("good-2026-10-05"))

    def test_config_env_overrides(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            Path(d, "config.local.json").write_text(json.dumps({"port": 1234, "forge_url": "http://x"}))
            cfg = load_config(Path(d), {"KILN_PORT": "7999"})
        self.assertEqual((cfg["port"], cfg["forge_url"], cfg["host"]), (7999, "http://x", "127.0.0.1"))

    def test_paths_live_apart_from_the_program(self) -> None:
        p = Paths.from_config({"output_dir": "/pics", "data_dir": "d"}, Path("/prog").resolve())
        self.assertEqual(p.queue_file, Path("/prog").resolve() / "d" / "queue.json")
        self.assertEqual(p.out, Path("/pics").resolve())


class Instance(TempDirs):
    def test_one_kiln_per_data_folder(self) -> None:
        a, b = InstanceLock(self.paths.data / "kiln.lock"), InstanceLock(self.paths.data / "kiln.lock")
        self.assertTrue(a.acquire())
        self.assertFalse(b.acquire(), "a second Kiln on the same data folder is refused")
        a.release()
        self.assertTrue(b.acquire(), "…and allowed once the first has gone")
        b.release()

    def test_the_next_free_port(self) -> None:
        taken = {7870, 7871}

        def make(port: int) -> str:
            if port in taken:
                raise OSError("in use")
            return f"server on {port}"

        self.assertEqual(bind_first(make, 7870), ("server on 7872", 7872))

    def test_a_port_is_never_shared(self) -> None:
        """Python's HTTP server sets "reuse address", which on Windows lets a second one share the port silently."""
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        from server.web import KilnServer

        first = KilnServer(("127.0.0.1", 0), None)  # type: ignore[arg-type]
        port = first.server_address[1]
        try:
            with self.assertRaises(OSError, msg="a second Kiln on the same port"):
                KilnServer(("127.0.0.1", port), None).server_close()  # type: ignore[arg-type]
            with self.assertRaises(OSError, msg="any other server asking to share it"):
                ThreadingHTTPServer(("127.0.0.1", port), BaseHTTPRequestHandler).server_close()
        finally:
            first.server_close()

    def test_instance_file(self) -> None:
        self.assertIsNone(read_instance(self.paths.data))
        write_instance(self.paths.data, 7874)
        self.assertEqual(read_instance(self.paths.data)["port"], 7874)  # type: ignore[index]
        (self.paths.data / "instance.json").write_text("{ broken")
        self.assertIsNone(read_instance(self.paths.data))


class Launcher(TempDirs):
    def test_finds_the_kiln_for_this_data_folder(self) -> None:
        def fetch(answer: dict | None):
            return lambda url: answer

        self.assertIsNone(running_port(self.paths, "127.0.0.1", fetch({"app": "kiln"})), "no instance file: none")
        write_instance(self.paths.data, 7871)
        mine = {"app": "kiln", "data": str(self.paths.data)}
        self.assertEqual(running_port(self.paths, "127.0.0.1", fetch(mine)), 7871)
        other_app = {"app": "something else", "data": str(self.paths.data)}
        self.assertIsNone(running_port(self.paths, "127.0.0.1", fetch(other_app)), "another program on the port")
        other_kiln = {"app": "kiln", "data": "D:/another/data"}
        self.assertIsNone(running_port(self.paths, "127.0.0.1", fetch(other_kiln)), "a Kiln for another folder")
        self.assertIsNone(running_port(self.paths, "127.0.0.1", fetch(None)), "nothing answers (a stale file)")

    def test_browser_order(self) -> None:
        env = {"ProgramFiles": "C:/PF", "ProgramFiles(x86)": "C:/PF86", "LOCALAPPDATA": "C:/LA"}

        def only(*names: str):
            return lambda p: any(n in p.as_posix() for n in names)

        self.assertEqual(find_browser(env, only("Edge", "Chrome"))[0], "Edge")  # type: ignore[index]
        self.assertEqual(find_browser(env, only("Google/Chrome"))[0], "Chrome")  # type: ignore[index]
        self.assertEqual(find_browser(env, only("Chromium"))[0], "Chromium")  # type: ignore[index]
        self.assertIsNone(find_browser(env, only("nothing")), "none: the default browser")
        self.assertEqual(find_browser({**env, "KILN_BROWSER": "X:/b.exe"}, only())[1], Path("X:/b.exe"))  # type: ignore[index]

    def test_the_window(self) -> None:
        env = {"LOCALAPPDATA": "C:/LA"}
        self.assertEqual(profile_dir("Edge", env), Path("C:/LA/Kiln/Edge"), "Edge keeps kiln.bat's old profile")
        self.assertEqual(profile_dir("Chrome", env), Path("C:/LA/Kiln/Chrome"))
        cmd = browser_command(("Edge", Path("C:/e.exe")), "http://127.0.0.1:7870", Path("C:/LA/Kiln/Edge"))
        self.assertIn("--app=http://127.0.0.1:7870", cmd)
        self.assertIn("--no-proxy-server", cmd)
        self.assertTrue(any(a.startswith("--user-data-dir=") for a in cmd))


class NetworkCalls(unittest.TestCase):
    """Nothing the server does reaches outside the machine unasked: only three places make requests at all."""

    ALLOWED: ClassVar[dict[str, str]] = {
        "backends/forge.py": "the image generator, at the address in the settings (local)",
        "updates.py": "the update check — only when you press Check for updates",
        "launch.py": "the launcher asking 127.0.0.1 who's there (/api/hello)",
    }
    CALLS = ("OPENER.open(", "urlopen(", "http.client", "create_connection(", ".connect((")

    def test_only_these_files_make_requests(self) -> None:
        root = Path(__file__).resolve().parents[3] / "server"
        found = {
            f.relative_to(root).as_posix()
            for f in root.rglob("*.py")
            if any(c in f.read_text(encoding="utf-8") for c in self.CALLS)
        }
        self.assertEqual(found, set(self.ALLOWED), "a new place making requests: check where it goes, then list it")


if __name__ == "__main__":
    unittest.main()


PARAMS = (
    "a quiet harbour at dusk, film grain <lora:detail:0.8>\nNegative prompt: blurry\n"
    "Steps: 4, Sampler: Euler, CFG scale: 1.0, Seed: 12345, Size: 1x1, Model: krea2_turbo"
)


class PictureIndex(TempDirs):
    def setUp(self) -> None:
        super().setUp()
        self.lib = library.Library(self.paths, Store.open(self.paths), background=False)

    def png(self, rel: str, params: str = PARAMS, series: str = "Harbour") -> Path:
        f = self.paths.out / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        data = images.add_text(images.add_text(tiny_png(), "parameters", params), "kiln_name", series)
        f.write_bytes(images.add_text(data, "kiln_id", "abc123"))
        return f

    def rows(self) -> dict[str, tuple]:
        con = self.lib.store.con
        return {
            r[0]: r[1:] for r in con.execute("SELECT path, kind, w, h, series, prompt, seed, kiln_id FROM pictures")
        }

    def test_reads_a_png_without_its_pixels(self) -> None:
        w, h, texts = library.png_meta(self.png("a.png"))
        self.assertEqual((w, h), (1, 1))
        self.assertEqual(texts["kiln_name"], "Harbour")
        self.assertTrue(texts["parameters"].startswith("a quiet harbour"))

    def test_parameters(self) -> None:
        p = library.parse_parameters(PARAMS)
        self.assertEqual(p["prompt"], "a quiet harbour at dusk, film grain")
        self.assertEqual(p["negative"], "blurry")
        self.assertEqual(p["loras"], [{"name": "detail", "w": 0.8}])
        self.assertEqual(p["settings"]["Seed"], "12345")
        other = library.parse_parameters('{"prompt": "made elsewhere"}')  # another tool's layout: kept whole
        self.assertEqual((other["prompt"], other["settings"]), ('{"prompt": "made elsewhere"}', {}))

    def test_a_scan_indexes_the_folder_and_its_folders(self) -> None:
        self.png("harbour-001.png")
        self.png("Harbour/harbour-002.png")
        (self.paths.out / "photo.jpg").write_bytes(b"\xff\xd8\xff")
        (self.paths.out / "clip.mp4").write_bytes(b"\0" * 16)
        (self.paths.out / "notes.txt").write_text("not a picture")
        self.assertEqual(self.lib.scan(), 4)
        r = self.rows()
        self.assertEqual(sorted(r), ["Harbour/harbour-002.png", "clip.mp4", "harbour-001.png", "photo.jpg"])
        self.assertEqual(
            r["harbour-001.png"], ("image", 1, 1, "Harbour", "a quiet harbour at dusk, film grain", 12345, "abc123")
        )
        self.assertEqual(r["clip.mp4"][0], "video")  # a media kind from the start: not PNG-only
        self.assertEqual(r["photo.jpg"][4:6], (None, None))  # no text: still indexed

    def test_a_rescan_reads_only_what_changed(self) -> None:
        a = self.png("a.png")
        self.png("b.png")
        self.lib.scan()
        self.assertEqual(self.lib.scan(), 0)  # nothing new: no file read
        a.write_bytes(images.add_text(tiny_png(), "parameters", "a lighthouse\nSteps: 4, Seed: 9"))
        os.utime(a, (time.time() + 5, time.time() + 5))
        (self.paths.out / "b.png").unlink()
        self.assertEqual(self.lib.scan(), 2)  # one changed, one gone
        self.assertEqual(list(self.rows()), ["a.png"])
        self.assertEqual(self.rows()["a.png"][4], "a lighthouse")

    def test_search_by_words(self) -> None:
        self.png("a.png")
        self.png("b.png", "a red cup on a table\nSteps: 4, Seed: 1", "Cup")
        self.lib.scan()
        con = self.lib.store.con
        hit = con.execute(
            "SELECT path FROM pictures WHERE id IN (SELECT rowid FROM pictures_fts WHERE pictures_fts MATCH 'harbour')"
        ).fetchall()
        self.assertEqual(hit, [("a.png",)])
        self.lib.index_file(self.paths.out / "a.png")
        (self.paths.out / "a.png").unlink()
        self.lib.index_file(self.paths.out / "a.png")  # gone: its row, and its words, go too
        self.assertEqual(
            con.execute("SELECT COUNT(*) FROM pictures_fts WHERE pictures_fts MATCH 'harbour'").fetchone()[0], 0
        )

    def test_clear_rebuilds_from_the_pictures(self) -> None:
        self.png("a.png")
        self.lib.scan()
        with self.lib.store.tx() as c:
            c.execute("DELETE FROM pictures")
        self.assertEqual(self.lib.count(), 0)
        self.lib.scan()
        self.assertEqual(self.lib.count(), 1)  # nothing lost: the pictures carry their own text


class PicturesKeepTheIndex(PicturesOnDisk):
    def setUp(self) -> None:
        super().setUp()
        self.lib = library.Library(self.paths, self.q.store, background=False)
        self.pics.library = self.lib
        self.lib.scan()

    def test_delete_and_undo_follow_in_the_index(self) -> None:
        self.assertEqual(self.lib.count(), 1)
        self.pics.act(self.jid, "delete")
        self.assertEqual(self.lib.count(), 0)
        self.pics.act(self.jid, "undelete")
        self.assertEqual(self.lib.count(), 1)


@unittest.skipUnless(library.thumbs.available(), "Pillow isn't installed: the page makes the Queue's thumbnails")
class Thumbnails(TempDirs):
    def setUp(self) -> None:
        super().setUp()
        self.lib = library.Library(self.paths, Store.open(self.paths), background=False)

    def picture(self, rel: str, w: int, h: int) -> Path:
        im = library.thumbs._Image.new("RGB", (w, h), (200, 80, 40))
        f = self.paths.out / rel
        im.save(f, "PNG")
        return f

    def test_made_on_demand_small_and_in_shape(self) -> None:
        f = self.picture("wide.png", 1600, 900)
        self.lib.scan()
        t = self.lib.thumb_for(f)
        self.assertIsNotNone(t)
        with library.thumbs._Image.open(t) as im:
            self.assertEqual(im.size, (384, 216))  # the long side 384, the shape kept (the Queue crops it square)
        self.assertEqual(self.lib.thumb_for(f), t)  # made once

    def test_a_changed_picture_gets_a_new_one_and_a_gone_one_leaves_none(self) -> None:
        f = self.picture("a.png", 64, 64)
        self.lib.scan()
        t1 = self.lib.thumb_for(f)
        self.picture("a.png", 80, 40)
        os.utime(f, (time.time() + 5, time.time() + 5))
        self.lib.scan()
        t2 = self.lib.thumb_for(f)
        self.assertNotEqual(t1, t2)
        self.assertFalse(t1.exists())  # the stale one is dropped at the scan
        f.unlink()
        self.lib.index_file(f)
        self.assertFalse(t2.exists())  # a deleted picture leaves no thumbnail behind

    def test_clear_removes_them(self) -> None:
        f = self.picture("a.png", 64, 64)
        self.lib.scan()
        t = self.lib.thumb_for(f)
        self.lib.clear()
        self.assertFalse(t.exists())
