"use client";

import { useEffect, useRef, useState } from "react";
import { default as languageCodesData } from "@/data/language-codes.json";
import { default as countryCodesData } from "@/data/country-codes.json";
import Image from "next/image";

const languageCodes: Record<string, string> = languageCodesData;
const countryCodes: Record<string, string> = countryCodesData;

export default function Translator1() {
  const [isActive, setIsActive] = useState(false);
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRestarting = useRef(false);
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice>>([]);
  const [language, setLanguage] = useState<string>("en-US");
  const [isRecognitionStarted, setIsRecognitionStarted] = useState(false);

  

  useEffect(() => {
    console.log("Language has been updated to:", language);
  }, [language]);

  useEffect(() => {
    const voices = window.speechSynthesis.getVoices();
    if (Array.isArray(voices) && voices.length > 0) {
      setVoices(voices);
      return;
    }
    if ("onvoiceschanged" in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        const voices = window.speechSynthesis.getVoices();
        setVoices(voices);
      };
    }
  }, []);

  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecognition = () => {
    // Ensure the AudioContext is created and resumed after a user gesture
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    } else if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true; // Enables continuous listening
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = language;

    // Set up echo cancellation in the media stream constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        recognitionRef.current!.onstart = () => {
          setIsActive(true);
          setText(""); // Clear the previous transcript when recognition starts
        };

        recognitionRef.current!.onend = () => {
          setIsActive(false);
          if (!isRestarting.current) {
            isRestarting.current = true;
            // Automatically restart recognition when it stops
            setTimeout(() => {
              recognitionRef.current?.start();
              isRestarting.current = false;
            }, 1000);
          }
        };

        recognitionRef.current!.onresult = async (event) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript.trim() + ". ";
          }

          setText(transcript); // Set the new transcript, replacing the previous one

          // Perform translation fetch for the new transcript
          const results = await fetch("/api/translate", {
            method: "POST",
            body: JSON.stringify({
              text: transcript,
            }),
          }).then((r) => r.json());

          if (results.length === 5) {
            setLanguage(results); // Set the language
            setTranslation("Language set to " + results);
            console.log("Language set to:", results);
          } else {
            // If not, proceed with the translation logic
            setTranslation(results);

            // Play the TTS audio using the Web Audio API
            speakWithOpenAITTS(results);
          }
        };

        recognitionRef.current!.start();
        setIsRecognitionStarted(true); // Indicate that recognition has started
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
      });
  };

  useEffect(() => {
    return () => {
      // Clean up on unmount
      recognitionRef.current?.stop();
      audioContextRef.current?.close();
    };
  }, []);

  const speakWithOpenAITTS = async (text: string) => {
    const API_URL = "https://api.openai.com/v1/audio/speech";

    const requestBody = {
      model: "tts-1", // OpenAI model ID
      input: text,
      voice: "shimmer", // You can customize this based on the available OpenAI voices
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(
          await audioBlob.arrayBuffer()
        );

        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;

        // Connect the audio source to the context destination (the speakers)
        source.connect(audioContextRef.current!.destination);

        source.start();
      } else {
        console.error("Failed to generate speech:", response.statusText);
      }
    } catch (error) {
      console.error("Error during OpenAI TTS request:", error);
    }
  };

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-lg">
      {!isRecognitionStarted && (
        <button 
          onClick={startRecognition} 
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-300"
        >
          Start Speech Recognition
        </button>
      )}
      {isRecognitionStarted && <p className="text-green-500 text-lg mt-4">Speech recognition is active...</p>}
      <p className="text-gray-700 mt-4">Transcript: {text}</p>
      <p className="text-gray-700 mt-2">Translation: {translation}</p>
    </div>
  );
}
