"""Unit tests of the server's own logic (no Forge, no browser): `python -m unittest discover -s tools/tests/unit`."""

import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from server import images, naming, timings
from server.backends.forge import bare, lora_folders, same_paths
from server.config import Paths, load_config
from server.errors import ApiError
from server.instance import InstanceLock, bind_first, read_instance, write_instance
from server.jobqueue import JobQueue, public
from server.launch import browser_command, find_browser, profile_dir, running_port
from server.lifecycle import window_gone
from server.page import styles_signature
from server.pictures import Pictures
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
            series, 42, out_dir=self.paths.out, job_files=files or [], names_file=self.paths.names_file, take=take
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
        self.assertEqual(json.loads(self.paths.names_file.read_text()), {"cup": 2})
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
        q = JobQueue(self.paths)
        with self.assertLogs("kiln", "WARNING"):
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


if __name__ == "__main__":
    unittest.main()
