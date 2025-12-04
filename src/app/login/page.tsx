"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="w-full h-screen flex bg-white text-[#1d1e25] overflow-hidden">
      {/* LEFT SIDE */}
      <div className="w-[52%] flex flex-col justify-center px-[140px]">
        
        {/* Logo */}
        <div className="mb-[48px]">
          <Image
            src="/airtable-logo.png"
            width={135}
            height={40}
            alt="Airtable"
            className="object-contain"
          />
        </div>

        {/* Heading */}
        <h1 className="text-[32px] font-semibold leading-tight mb-[32px]">
          Sign in to Airtable
        </h1>

        {/* Email Input */}
        <input
          type="email"
          placeholder="Email address"
          className="w-full border border-[#d4d7e0] rounded-md px-4 py-[14px]
                     text-[15px] focus:outline-none focus:ring-2
                     focus:ring-[#688ec9] transition mb-[16px]"
        />

        {/* Continue Button */}
        <button
          className="w-full h-[44px] bg-[#8eaee6] text-white rounded-md
                     text-[15px] font-medium hover:bg-[#7fa2e2] transition"
        >
          Continue
        </button>

        {/* Divider */}
        <div className="flex items-center my-[24px]">
          <div className="h-[1px] bg-[#e2e3e7] flex-1" />
          <span className="mx-3 text-[#6e6f77] text-[13px]">or</span>
          <div className="h-[1px] bg-[#e2e3e7] flex-1" />
        </div>

        {/* SSO */}
        <button className="w-full h-[44px] border border-[#d4d7e0] rounded-md
                           text-[15px] text-[#2d2e33] hover:bg-[#f7f7f9]
                           transition mb-[12px] font-medium">
          Sign in with <span className="font-semibold">Single Sign On</span>
        </button>

        {/* Google */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full h-[44px] border border-[#d4d7e0] rounded-md
                     flex items-center justify-center gap-3 hover:bg-[#f7f7f9]
                     transition mb-[12px]"
        >
          <Image src="/google.png" alt="Google" width={20} height={20} />
          <span className="text-[15px]">
            Continue with <span className="font-semibold">Google</span>
          </span>
        </button>

        {/* Apple */}
        <button
          className="w-full h-[44px] border border-[#d4d7e0] rounded-md
                     flex items-center justify-center gap-3 hover:bg-[#f7f7f9]
                     transition"
        >
          <Image src="/apple.png" alt="Apple" width={20} height={20} />
          <span className="text-[15px]">
            Continue with <span className="font-semibold">Apple ID</span>
          </span>
        </button>

        {/* Footer */}
        <p className="mt-[32px] text-[13px] text-[#6e6f77]">
          New to Airtable?{" "}
          <a href="#" className="text-[#2667d2] hover:underline">
            Create an account
          </a>{" "}
          instead
        </p>
      </div>

      {/* RIGHT SIDE BLOCK */}
      <div className="w-[48%] bg-white flex items-center justify-center px-10">
        <div className="rounded-xl overflow-hidden shadow-lg">
          <Image
            src="/login.jpeg" 
            alt="Airtable Right Panel"
            width={420}
            height={700}
            className="rounded-xl object-cover"
          />
        </div>
      </div>
    </div>
  );
}
