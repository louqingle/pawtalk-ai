"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Cat,
  Dog,
  Bird,
  CircleHelp,
  Mic,
  Square,
  Upload,
  RotateCcw,
  Share2,
  History,
  Sparkles,
  ShieldCheck,
  Camera,
  Trash2,
  ChevronRight,
  Activity,
  Image as ImageIcon,
  Zap,
  Volume2,
  Crown,
  LockKeyhole,
  LogOut,
  User,
} from "lucide-react";

import Auth from "@/components/Auth";
import { createClient } from "@/lib/supabase/client";

type Animal = "猫咪" | "狗狗" | "鸟类" | "其他";
type Tab = "sound" | "photo";

type Result = {
  id: string;
  animal: Animal;
  phrase: string;
  mood: string;
  attention: number;
  tension: number;
  excitement: number;
  confidence: number;
  detail: string;
  nextTip: string;
  createdAt: string;
  source: "声音" | "照片";
};

const animals: {
  name: Animal;
  icon: React.ReactNode;
}[] = [
  {
    name: "猫咪",
    icon: <Cat size={22} />,
  },
  {
    name: "狗狗",
    icon: <Dog size={22} />,
  },
  {
    name: "鸟类",
    icon: <Bird size={22} />,
  },
  {
    name: "其他",
    icon: <CircleHelp size={22} />,
  },
];

export default function Home() {
  const supabase = createClient();

  const [session, setSession] =
    useState<any>(null);

  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [showAccount, setShowAccount] =
    useState(false);

  const [animal, setAnimal] =
    useState<Animal>("猫咪");

  const [tab, setTab] =
    useState<Tab>("sound");

  const [recording, setRecording] =
    useState(false);

  const [seconds, setSeconds] =
    useState(0);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [result, setResult] =
    useState<Result | null>(null);

  const [history, setHistory] =
    useState<Result[]>([]);

  const [photo, setPhoto] =
    useState<string | null>(null);

  const [inputName, setInputName] =
    useState("");

  const [error, setError] =
    useState("");

  const [uses, setUses] =
    useState(0);

  const [showPro, setShowPro] =
    useState(false);

  const [volume, setVolume] =
    useState(0);

  const [isSilent, setIsSilent] =
    useState(false);

  const mediaRecorder =
    useRef<MediaRecorder | null>(null);

  const chunks =
    useRef<Blob[]>([]);

  const timer =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const animationRef =
    useRef<number | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  /*
   * ============================
   * Supabase 登录状态
   * ============================
   */

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(session);

        if (session?.user) {
          setAvatarUrl(
            session.user.user_metadata
              ?.avatar_url || null
          );
        } else {
          setAvatarUrl(null);
        }

        setAuthLoading(false);
      } catch (error) {
        console.error(
          "Supabase session error:",
          error
        );

        if (mounted) {
          setSession(null);
          setAvatarUrl(null);
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!mounted) return;

          setSession(session);

          if (session?.user) {
            setAvatarUrl(
              session.user.user_metadata
                ?.avatar_url || null
            );
          } else {
            setAvatarUrl(null);
            setShowAccount(false);
          }

          setAuthLoading(false);
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  /*
   * ============================
   * 本地历史
   * ============================
   */

  useEffect(() => {
    if (!session) return;

    try {
      const saved =
        localStorage.getItem(
          "pawtalk-history-v3"
        );

      if (saved) {
        setHistory(
          JSON.parse(saved)
        );
      }
    } catch (error) {
      console.warn(
        "读取历史失败:",
        error
      );
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    try {
      localStorage.setItem(
        "pawtalk-history-v3",
        JSON.stringify(history)
      );
    } catch (error) {
      console.warn(
        "保存历史失败:",
        error
      );
    }
  }, [history, session]);

  /*
   * ============================
   * 页面清理
   * ============================
   */

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }

      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /*
   * ============================
   * 读取服务器额度
   * ============================
   */

  const loadCredits = async () => {
    try {
      const response =
        await fetch(
          "/api/credits",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      if (!response.ok) return;

      const data =
        await response.json();

      if (
        typeof data.used ===
        "number"
      ) {
        setUses(data.used);
      } else if (
        typeof data.remaining ===
        "number"
      ) {
        setUses(
          Math.max(
            0,
            5 - data.remaining
          )
        );
      }
    } catch (error) {
      console.warn(
        "读取额度失败:",
        error
      );
    }
  };

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  /*
   * ============================
   * 退出登录
   * ============================
   */

  const logout = async () => {
    try {
      setShowAccount(false);

      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "退出登录失败:",
          error
        );

        setError(
          "退出登录失败，请重试。"
        );

        return;
      }

      /*
       * 立即清理本地状态
       */
      setSession(null);
      setAvatarUrl(null);
      setResult(null);
      setHistory([]);
      setPhoto(null);
      setInputName("");
      setUses(0);
      setShowPro(false);
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      setError(
        "退出登录失败，请重试。"
      );
    }
  };

  /*
   * ============================
   * 音频特征
   * ============================
   */

  const extractAudioFeatures =
    async (
      file: File
    ): Promise<
      Record<string, number> | null
    > => {
      try {
        const arrayBuffer =
          await file.arrayBuffer();

        const AudioContextClass =
          window.AudioContext ||
          (window as any)
            .webkitAudioContext;

        if (!AudioContextClass) {
          return null;
        }

        const audioContext =
          new AudioContextClass();

        const audioBuffer =
          await audioContext.decodeAudioData(
            arrayBuffer
          );

        const channelData =
          audioBuffer.getChannelData(
            0
          );

        const sampleRate =
          audioBuffer.sampleRate;

        let sumSquares = 0;
        let peak = 0;
        let zeroCrossings = 0;

        for (
          let i = 0;
          i < channelData.length;
          i++
        ) {
          const value =
            channelData[i];

          sumSquares +=
            value * value;

          peak = Math.max(
            peak,
            Math.abs(value)
          );

          if (i > 0) {
            const previous =
              channelData[
                i - 1
              ];

            if (
              (previous >= 0 &&
                value < 0) ||
              (previous < 0 &&
                value >= 0)
            ) {
              zeroCrossings++;
            }
          }
        }

        const sampleCount =
          Math.max(
            channelData.length,
            1
          );

        const rms =
          Math.sqrt(
            sumSquares /
              sampleCount
          );

        const zeroCrossingRate =
          zeroCrossings /
          sampleCount;

        const estimatedFrequency =
          (zeroCrossingRate *
            sampleRate) /
          2;

        let silentSamples = 0;

        for (
          let i = 0;
          i < channelData.length;
          i++
        ) {
          if (
            Math.abs(
              channelData[i]
            ) < 0.01
          ) {
            silentSamples++;
          }
        }

        const silenceRatio =
          silentSamples /
          sampleCount;

        const features = {
          duration: Number(
            audioBuffer.duration.toFixed(
              2
            )
          ),
          rms: Number(
            rms.toFixed(5)
          ),
          peak: Number(
            peak.toFixed(5)
          ),
          silenceRatio: Number(
            silenceRatio.toFixed(3)
          ),
          zeroCrossingRate:
            Number(
              zeroCrossingRate.toFixed(
                5
              )
            ),
          estimatedFrequency:
            Number(
              estimatedFrequency.toFixed(
                1
              )
            ),
          sampleRate,
        };

        await audioContext.close();

        return features;
      } catch (error) {
        console.warn(
          "Audio feature extraction failed:",
          error
        );

        return null;
      }
    };

  /*
   * ============================
   * AI 分析
   * ============================
   */

  const analyzeFile = async (
    file: File,
    source:
      | "声音"
      | "照片"
  ) => {
    if (!session) {
      setError(
        "请先登录后再进行分析。"
      );
      return;
    }

    if (uses >= 5) {
      setShowPro(true);
      return;
    }

    setError("");
    setAnalyzing(true);
    setResult(null);

    try {
      let audioFeatures:
        | Record<string, number>
        | null = null;

      if (source === "声音") {
        audioFeatures =
          await extractAudioFeatures(
            file
          );
      }

      const fd =
        new FormData();

      fd.append(
        "animal",
        animal
      );

      fd.append(
        "source",
        source
      );

      fd.append(
        "file",
        file
      );

      if (audioFeatures) {
        fd.append(
          "audioFeatures",
          JSON.stringify(
            audioFeatures
          )
        );
      }

      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",
            body: fd,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          response.status ===
          401
        ) {
          setSession(null);
          setAvatarUrl(null);

          throw new Error(
            "登录状态已失效，请重新登录。"
          );
        }

        if (
          response.status ===
          402
        ) {
          setUses(5);
          setShowPro(true);

          throw new Error(
            "免费次数已经用完。"
          );
        }

        throw new Error(
          data.error ||
            "分析失败"
        );
      }

      const newResult: Result =
        {
          ...data,
          id: crypto.randomUUID(),
          createdAt:
            new Date().toLocaleTimeString(
              "zh-CN",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            ),
          source,
        };

      setResult(
        newResult
      );

      setHistory(
        (items) =>
          [
            newResult,
            ...items,
          ].slice(0, 12)
      );

      await loadCredits();
    } catch (error: any) {
      setError(
        error?.message ||
          "分析失败，请重试"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /*
   * ============================
   * 实时可视化
   * ============================
   */

  const startVisualizer = (
    stream: MediaStream
  ) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as any)
          .webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext =
        new AudioContextClass();

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant =
        0.8;

      const source =
        audioContext.createMediaStreamSource(
          stream
        );

      source.connect(
        analyser
      );

      audioContextRef.current =
        audioContext;

      analyserRef.current =
        analyser;

      const data =
        new Uint8Array(
          analyser.fftSize
        );

      const draw = () => {
        const canvas =
          canvasRef.current;

        const currentAnalyser =
          analyserRef.current;

        if (
          !canvas ||
          !currentAnalyser
        ) {
          return;
        }

        const ctx =
          canvas.getContext(
            "2d"
          );

        if (!ctx) return;

        currentAnalyser.getByteTimeDomainData(
          data
        );

        let sum = 0;

        for (
          let i = 0;
          i < data.length;
          i++
        ) {
          const normalized =
            (data[i] - 128) /
            128;

          sum +=
            normalized *
            normalized;
        }

        const rms =
          Math.sqrt(
            sum /
              data.length
          );

        const currentVolume =
          Math.min(
            100,
            Math.round(
              rms * 320
            )
          );

        setVolume(
          currentVolume
        );

        setIsSilent(
          currentVolume < 5
        );

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.beginPath();

        const sliceWidth =
          canvas.width /
          data.length;

        for (
          let i = 0;
          i < data.length;
          i++
        ) {
          const x =
            i *
            sliceWidth;

          const y =
            (data[i] / 255) *
            canvas.height;

          if (i === 0) {
            ctx.moveTo(
              x,
              y
            );
          } else {
            ctx.lineTo(
              x,
              y
            );
          }
        }

        ctx.strokeStyle =
          "rgba(255,255,255,0.9)";

        ctx.lineWidth = 2;

        ctx.stroke();

        animationRef.current =
          requestAnimationFrame(
            draw
          );
      };

      draw();
    } catch (error) {
      console.warn(
        "Visualizer error:",
        error
      );
    }
  };

  const stopVisualizer =
    () => {
      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );

        animationRef.current =
          null;
      }

      if (
        audioContextRef.current
      ) {
        audioContextRef.current.close();

        audioContextRef.current =
          null;
      }

      analyserRef.current =
        null;

      setVolume(0);
      setIsSilent(false);

      const canvas =
        canvasRef.current;

      if (canvas) {
        const ctx =
          canvas.getContext(
            "2d"
          );

        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
          );
        }
      }
    };

  /*
   * ============================
   * 开始录音
   * ============================
   */

  const startRecording =
    async () => {
      if (!session) {
        setError(
          "请先登录。"
        );
        return;
      }

      if (uses >= 5) {
        setShowPro(true);
        return;
      }

      try {
        setError("");

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            }
          );

        const recorder =
          new MediaRecorder(
            stream
          );

        chunks.current = [];

        recorder.ondataavailable =
          (event) => {
            if (
              event.data.size >
              0
            ) {
              chunks.current.push(
                event.data
              );
            }
          };

        recorder.onstop =
          () => {
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            stopVisualizer();

            const blob =
              new Blob(
                chunks.current,
                {
                  type:
                    recorder.mimeType ||
                    "audio/webm",
                }
              );

            const file =
              new File(
                [blob],
                "pet-recording.webm",
                {
                  type:
                    blob.type ||
                    "audio/webm",
                }
              );

            analyzeFile(
              file,
              "声音"
            );
          };

        mediaRecorder.current =
          recorder;

        startVisualizer(
          stream
        );

        recorder.start();

        setRecording(
          true
        );

        setSeconds(0);

        timer.current =
          setInterval(
            () => {
              setSeconds(
                (value) =>
                  value + 1
              );
            },
            1000
          );
      } catch (error) {
        console.error(
          error
        );

        setError(
          "无法访问麦克风，请允许浏览器使用麦克风。"
        );
      }
    };

  /*
   * ============================
   * 停止录音
   * ============================
   */

  const stopRecording =
    () => {
      if (
        mediaRecorder.current
          ?.state ===
        "recording"
      ) {
        mediaRecorder.current.stop();
      }

      setRecording(
        false
      );

      if (
        timer.current
      ) {
        clearInterval(
          timer.current
        );

        timer.current =
          null;
      }
    };

  /*
   * ============================
   * 上传声音
   * ============================
   */

  const handleAudio = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setInputName(
      file.name
    );

    analyzeFile(
      file,
      "声音"
    );
  };

  /*
   * ============================
   * 上传照片
   * ============================
   */

  const handlePhoto = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setInputName(
      file.name
    );

    if (photo) {
      URL.revokeObjectURL(
        photo
      );
    }

    const preview =
      URL.createObjectURL(
        file
      );

    setPhoto(
      preview
    );

    analyzeFile(
      file,
      "照片"
    );
  };

  /*
   * ============================
   * 清空历史
   * ============================
   */

  const clearHistory =
    () => {
      setHistory([]);

      try {
        localStorage.removeItem(
          "pawtalk-history-v3"
        );
      } catch (error) {
        console.warn(
          error
        );
      }
    };

  /*
   * ============================
   * 重置
   * ============================
   */

  const reset = () => {
    setResult(null);
    setInputName("");
    setError("");
    setVolume(0);
    setIsSilent(false);

    if (photo) {
      URL.revokeObjectURL(
        photo
      );
    }

    setPhoto(null);
  };

  /*
   * ============================
   * 分享
   * ============================
   */

  const share = async () => {
    if (!result) return;

    const text =
      `PawTalk AI：${result.animal}｜${result.mood}｜置信度 ${result.confidence}%`;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            "PawTalk AI V3",
          text,
        });
      } else {
        await navigator.clipboard.writeText(
          text
        );
      }
    } catch {}
  };

  /*
   * ============================
   * 登录检查
   * ============================
   */

  if (authLoading) {
    return (
      <main className="authPage">
        <div className="loadingAuth">
          <div className="brand authBrand">
            <div className="brandMark">
              <AudioLines
                size={20}
              />
            </div>

            <span>
              PawTalk{" "}
              <b>AI</b>
            </span>

            <em>V3</em>
          </div>

          <p>
            正在检查登录状态...
          </p>
        </div>
      </main>
    );
  }

  /*
   * ============================
   * 未登录
   * ============================
   */

  if (!session) {
    return (
      <main className="authPage">
        <div className="authContainer">
          <div className="brand authBrand">
            <div className="brandMark">
              <AudioLines
                size={20}
              />
            </div>

            <span>
              PawTalk{" "}
              <b>AI</b>
            </span>

            <em>V3</em>
          </div>

          <Auth
            onSuccess={() => {
              /*
               * 不再依赖 reload。
               * Supabase onAuthStateChange
               * 会自动更新 session。
               */
            }}
          />
        </div>
      </main>
    );
  }

  /*
   * ============================
   * 主界面
   * ============================
   */

  return (
    <main>
      <div className="navRight">
        <span className="statusDot" />

        真实 AI 多模态分析

        <button
          className="proBtn"
          onClick={() =>
            setShowPro(true)
          }
        >
          <Crown size={13} />
          PRO
        </button>

        {/* ======================
            用户账户
           ====================== */}

        <div className="account">
          <button
            className="accountButton"
            onClick={() =>
              setShowAccount(
                (value) =>
                  !value
              )
            }
            title={
              session.user.email ||
              "我的账户"
            }
          >
            <div className="avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="用户头像"
                  onError={() =>
                    setAvatarUrl(
                      null
                    )
                  }
                />
              ) : (
                <User size={18} />
              )}
            </div>

            <span className="accountName">
              {session.user
                .user_metadata
                ?.full_name ||
                session.user.email?.split(
                  "@"
                )[0] ||
                "我的账户"}
            </span>

            <ChevronRight
              size={15}
              className={
                showAccount
                  ? "rotate"
                  : ""
              }
            />
          </button>

          {showAccount && (
            <div className="accountMenu">
              <div className="accountInfo">
                <div className="avatar large">
                  {avatarUrl ? (
                    <img
                      src={
                        avatarUrl
                      }
                      alt="用户头像"
                      onError={() =>
                        setAvatarUrl(
                          null
                        )
                      }
                    />
                  ) : (
                    <User size={22} />
                  )}
                </div>

                <div>
                  <strong>
                    {session.user
                      .user_metadata
                      ?.full_name ||
                      "PawTalk 用户"}
                  </strong>

                  <small>
                    {
                      session.user
                        .email
                    }
                  </small>
                </div>
              </div>

              <div className="accountDivider" />

              <button
                className="logoutButton"
                onClick={
                  logout
                }
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="hero">
        <div className="pill">
          <Sparkles size={14} />
          V3 · REAL AI MULTIMODAL
        </div>

        <h1>
          不是“翻译”，是
          <span>
            理解线索。
          </span>
        </h1>

        <p>
          上传宠物声音或照片，让 AI
          从可观察的声音、姿态、表情和环境线索，
          推测它当前可能的情绪与互动需求。
        </p>

        <div className="heroStats">
          <span>
            <Zap size={14} />
            真实 AI
          </span>

          <span>
            <Camera size={14} />
            图像理解
          </span>

          <span>
            <Activity size={14} />
            行为指标
          </span>

          <span>
            <LockKeyhole size={14} />
            密钥不进前端
          </span>
        </div>
      </section>

      <section className="workspace">
        <div className="card">
          <div className="cardHead">
            <div>
              <h2>
                ① 选择宠物
              </h2>

              <p>
                免费剩余{" "}
                {Math.max(
                  0,
                  5 - uses
                )}{" "}
                / 5 次
              </p>
            </div>

            <ShieldCheck size={19} />
          </div>

          <div className="animals">
            {animals.map(
              (item) => (
                <button
                  key={
                    item.name
                  }
                  className={`animal ${
                    animal ===
                    item.name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setAnimal(
                      item.name
                    )
                  }
                >
                  {item.icon}

                  <span>
                    {item.name}
                  </span>

                  {animal ===
                    item.name && (
                    <ChevronRight
                      size={16}
                    />
                  )}
                </button>
              )
            )}
          </div>

          <div className="tabs">
            <button
              className={
                tab === "sound"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab(
                  "sound"
                )
              }
            >
              <Volume2 size={16} />
              声音分析
            </button>

            <button
              className={
                tab === "photo"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab(
                  "photo"
                )
              }
            >
              <Camera size={16} />
              照片分析
            </button>
          </div>

          {tab === "sound" ? (
            <>
              <div
                className={`recorder ${
                  recording
                    ? "recording"
                    : ""
                } ${
                  analyzing
                    ? "analyzing"
                    : ""
                }`}
              >
                <div className="orb">
                  {analyzing ? (
                    <Sparkles
                      size={34}
                    />
                  ) : recording ? (
                    <Square
                      size={28}
                      fill="currentColor"
                    />
                  ) : (
                    <Mic size={34} />
                  )}
                </div>

                {recording ? (
                  <>
                    <strong>
                      正在聆听 ·{" "}
                      {String(
                        Math.floor(
                          seconds /
                            60
                        )
                      ).padStart(
                        2,
                        "0"
                      )}
                      :
                      {String(
                        seconds % 60
                      ).padStart(
                        2,
                        "0"
                      )}
                    </strong>

                    <canvas
                      ref={
                        canvasRef
                      }
                      width={600}
                      height={100}
                      style={{
                        width:
                          "100%",
                        height:
                          "100px",
                        marginTop:
                          "16px",
                        borderRadius:
                          "14px",
                        background:
                          "rgba(255,255,255,0.04)",
                      }}
                    />

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        width:
                          "100%",
                        marginTop:
                          "10px",
                        fontSize:
                          "13px",
                        opacity:
                          0.75,
                      }}
                    >
                      <span>
                        {isSilent
                          ? "等待声音…"
                          : "正在检测声音"}
                      </span>

                      <span>
                        音量{" "}
                        <b>
                          {volume}%
                        </b>
                      </span>
                    </div>

                    <div
                      style={{
                        width:
                          "100%",
                        height:
                          "5px",
                        background:
                          "rgba(255,255,255,0.08)",
                        borderRadius:
                          "99px",
                        overflow:
                          "hidden",
                        marginTop:
                          "8px",
                      }}
                    >
                      <div
                        style={{
                          width: `${volume}%`,
                          height:
                            "100%",
                          background:
                            "currentColor",
                          borderRadius:
                            "99px",
                          transition:
                            "width 80ms linear",
                        }}
                      />
                    </div>

                    <div className="waves">
                      {Array.from(
                        {
                          length: 18,
                        }
                      ).map(
                        (
                          _,
                          index
                        ) => (
                          <i
                            key={
                              index
                            }
                            style={{
                              animationDelay:
                                `${
                                  index *
                                  0.07
                                }s`,
                            }}
                          />
                        )
                      )}
                    </div>

                    <button
                      className="primary stop"
                      onClick={
                        stopRecording
                      }
                    >
                      <Square
                        size={16}
                        fill="currentColor"
                      />
                      结束录音
                    </button>
                  </>
                ) : analyzing ? (
                  <>
                    <strong>
                      AI 正在分析…
                    </strong>

                    <p>
                      提取声音特征并生成行为推测
                    </p>

                    <div className="loader">
                      <span />
                      <span />
                      <span />
                    </div>
                  </>
                ) : (
                  <>
                    <strong>
                      录一段它的声音
                    </strong>

                    <p>
                      建议 3–15 秒，环境尽量安静
                    </p>

                    <button
                      className="primary"
                      onClick={
                        startRecording
                      }
                    >
                      <Mic size={18} />
                      开始录音
                    </button>
                  </>
                )}
              </div>

              {!recording &&
                !analyzing && (
                  <label className="upload">
                    <Upload
                      size={17}
                    />

                    <span>
                      {inputName ||
                        "上传已有宠物录音"}
                    </span>

                    <input
                      type="file"
                      accept="audio/*"
                      onChange={
                        handleAudio
                      }
                    />
                  </label>
                )}
            </>
          ) : (
            <>
              <div className="photoBox">
                {photo ? (
                  <img
                    src={photo}
                    alt="宠物预览"
                  />
                ) : (
                  <div className="photoEmpty">
                    <ImageIcon
                      size={38}
                    />

                    <strong>
                      上传一张宠物照片
                    </strong>

                    <p>
                      AI
                      观察姿态、表情和环境线索
                    </p>
                  </div>
                )}

                {analyzing && (
                  <div className="scan">
                    <Sparkles
                      size={20}
                    />
                    AI 正在观察
                  </div>
                )}
              </div>

              {!analyzing && (
                <label className="upload">
                  <Camera size={17} />

                  <span>
                    {inputName ||
                      "选择照片"}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={
                      handlePhoto
                    }
                  />
                </label>
              )}
            </>
          )}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <p className="disclaimer">
            <ShieldCheck size={14} />
            行为推测不是医学诊断，也不能证明动物“真的说了这句话”。
          </p>
        </div>

        <div className="card resultCard">
          {!result ? (
            <div className="empty">
              <div className="emptyIcon">
                <AudioLines size={31} />
              </div>

              <h2>
                {error
                  ? "分析没有完成"
                  : "等待 AI 分析"}
              </h2>

              <p>
                {error
                  ? "检查 API 配置或稍后重试。"
                  : "上传声音或照片，V3 会调用服务器端 AI 生成报告。"}
              </p>

              <div className="miniFeatures">
                <span>
                  情绪概率
                </span>

                <span>
                  行为推测
                </span>

                <span>
                  下一步建议
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="resultTop">
                <div>
                  <span className="eyebrow">
                    V3 · AI ANALYSIS COMPLETE
                  </span>

                  <h2>
                    {result.animal} ·
                    分析完成
                  </h2>

                  <small className="source">
                    来自{" "}
                    {result.source}{" "}
                    ·{" "}
                    {result.createdAt}
                  </small>
                </div>

                <div className="confidence">
                  {
                    result.confidence
                  }
                  %

                  <small>
                    置信度
                  </small>
                </div>
              </div>

              <div className="quote">
                {result.phrase}
              </div>

              <div className="mood">
                <span>
                  当前状态
                </span>

                <strong>
                  {result.mood}
                </strong>
              </div>

              <Metric
                label="互动需求"
                value={
                  result.attention
                }
              />

              <Metric
                label="紧张程度"
                value={
                  result.tension
                }
              />

              <Metric
                label="兴奋程度"
                value={
                  result.excitement
                }
              />

              <div className="detail">
                <Sparkles
                  size={17}
                />

                <div>
                  <b>
                    AI 观察
                  </b>

                  <p>
                    {result.detail}
                  </p>
                </div>
              </div>

              <div className="nextTip">
                <b>
                  下一步建议
                </b>

                <span>
                  {result.nextTip}
                </span>
              </div>

              <div className="actions">
                <button
                  onClick={
                    reset
                  }
                >
                  <RotateCcw
                    size={16}
                  />
                  再分析
                </button>

                <button
                  onClick={
                    share
                  }
                >
                  <Share2
                    size={16}
                  />
                  分享结果
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="history">
        <div className="sectionTitle">
          <h2>
            <History size={19} />
            最近分析
          </h2>

          {history.length >
            0 && (
            <button
              onClick={
                clearHistory
              }
            >
              <Trash2
                size={14}
              />
              清空
            </button>
          )}
        </div>

        {history.length ===
        0 ? (
          <div className="historyEmpty">
            完成第一次分析后会自动保存在本机。
          </div>
        ) : (
          <div className="historyGrid">
            {history.map(
              (item) => (
                <button
                  key={
                    item.id
                  }
                  className="historyItem"
                  onClick={() =>
                    setResult(
                      item
                    )
                  }
                >
                  <span>
                    {item.animal} ·{" "}
                    {
                      item.source
                    }
                  </span>

                  <b>
                    {item.mood}
                  </b>

                  <small>
                    {
                      item.confidence
                    }
                    % 置信度 ·{" "}
                    {
                      item.createdAt
                    }
                  </small>
                </button>
              )
            )}
          </div>
        )}
      </section>

      <footer>
        © 2026 PawTalk AI V3 ·
        真实 AI 分析需要配置服务器端 API Key。
      </footer>

      {showPro && (
        <div
          className="modal"
          onClick={() =>
            setShowPro(false)
          }
        >
          <div
            className="modalCard"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <Crown size={30} />

            <h2>
              PawTalk PRO
            </h2>

            <p>
              V3
              已预留会员体系：无限分析、历史云同步、高级报告与更多宠物模型。
            </p>

            <div className="price">
              $4.99{" "}
              <small>
                / 月
              </small>
            </div>

            <button
              className="primary"
              onClick={() =>
                setShowPro(
                  false
                )
              }
            >
              先继续体验
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="metric">
      <div>
        <span>
          {label}
        </span>

        <b>
          {value}%
        </b>
      </div>

      <div className="bar">
        <i
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}
