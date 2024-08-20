"use client";

import { useState, useEffect, useRef } from "react";

import { default as languageCodesData } from "@/data/language-codes.json";
import { default as countryCodesData } from "@/data/country-codes.json";
import Image from "next/image";


const languageCodes: Record<string, string> = languageCodesData;
const countryCodes: Record<string, string> = countryCodesData;

const Translator = () => {
  const recognitionRef = useRef<SpeechRecognition>();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [text, setText] = useState<string>();
  const [translation, setTranslation] = useState<string>();
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice>>();
  const [language, setLanguage] = useState<string>("en-US");

  useEffect(() => {
    console.log("Language has been updated to:", language);
  }, [language]);

  const isSpeechDetected = false;
  
  // Language and voice stuffs..........................................................................

  const availableLanguages = Array.from(
    new Set(voices?.map(({ lang }) => lang))
  )
    .map((lang) => {
      const split = lang.split("-");
      const languageCode: string = split[0];
      const countryCode: string = split[1];
      return {
        lang,
        label: languageCodes[languageCode] || lang,
        dialect: countryCodes[countryCode],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const activeLanguage = availableLanguages.find(
    ({ lang }) => language === lang
  );

  const availableVoices = voices?.filter(({ lang }) => lang === language);
  const activeVoice =
    availableVoices?.find(({ name }) => name.includes("Google")) ||
    availableVoices?.find(({ name }) => name.includes("Luciana")) ||
    availableVoices?.[0];

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

  function handleOnRecord() {
    if (isActive) {
      recognitionRef.current?.stop();
      setIsActive(false);
      return;
    }

    speak(" ");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = language;

    recognitionRef.current.onstart = function () {
      setIsActive(true);
    };

    recognitionRef.current.onend = function () {
      setIsActive(false);
      //recognitionRef.current?.start();
    };

    recognitionRef.current.onresult = async function (event) {
     // const transcript = event.results[0][0].transcript;

      let transcript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        } else {
          transcript += event.results[i][0].transcript;
        }
      }

      console.log(transcript);

    
      // SpeechRecognition. = function (event) {
      //   let result = '';
    
      //   for (let i = event.resultIndex; i < event.results.length; i++) {
      //     if (event.results[i].isFinal) {
      //       result += event.results[i][0].transcript + ' ';
      //     } else {
      //       result += event.results[i][0].transcript;
      //     }
      //   }

      setText(transcript);
      //recognitionRef.current?.start();

      const results = await fetch("/api/translate", {
        method: "POST",
        body: JSON.stringify({
          text: transcript,
        }),
      }).then((r) => r.json());

      //console.log(results);

      if (results.length === 5) {
        setLanguage(results); // Set the language
        setTranslation("Language set to " + results);
        speak("Language set to " + results); // Speak the language

        // Log the value directly
        console.log("Language set to:", results);
      } else {
        // If not, proceed with the translation logic
        setTranslation(results);
        speak(results); // Perform other actions
      }
    };

    recognitionRef.current.start();
  }

  // useEffect(() => {
  //   // Automatically start recognition when the component mounts
  //   handleOnRecord();
  //   return () => {
  //     // Clean up on unmount
  //     recognitionRef.current?.stop();
  //   };
  // }, []);

  function speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);

    if (activeVoice) {
      utterance.voice = activeVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen px-4">
      {/* Image Container */}
      <div className="relative flex justify-center items-center w-80 h-80 mb-6">
        {/* Grey Border */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-gray-400 to-gray-500 p-1 animate-borderGlow">
          {/* Inner Circle */}
          <div className="w-full h-full bg-white rounded-full">
            <Image
              src="/megamind_tech_logo.jpg" // Path relative to the public folder
              alt="Top Image"
              width={320} // Ensures it's a square (80 * 4 = 320px)
              height={320} // Ensures it's a square
              objectFit="cover"
              className="rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="max-w-lg w-full rounded-xl overflow-hidden bg-white/70 backdrop-blur-lg p-6 shadow-md transform transition-all hover:scale-105 duration-500 ease-in-out border border-gray-200">
        <div className="max-w-lg mx-auto text-center">
          <p className="mb-4 text-gray-800 text-lg">
            Spoken Text: <span className="font-semibold text-black">{text}</span>
          </p>
          <p className="text-gray-800 text-lg">
            Translation: <span className="font-semibold text-black">{translation}</span>
          </p>
        </div>

        {/* Button */}
        <div className="flex justify-center items-center mt-8">
          <button
            className={`w-48 uppercase font-semibold text-sm py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
              isActive
                ? "text-white bg-red-400 hover:bg-red-500"
                : "text-white bg-blue-400 hover:bg-blue-500"
            }`}
            onClick={handleOnRecord}
          >
            {isActive ? "Stop" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Translator;
