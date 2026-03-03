"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare } from "lucide-react";
import { sendEnquiry } from "@/app/(dashboard)/direct/actions";

interface EnquiryFormProps {
  professionalId: string;
  companyName: string;
}

export function EnquiryForm({ professionalId, companyName }: EnquiryFormProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await sendEnquiry(professionalId, { subject, message });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setSubject("");
        setMessage("");
      }, 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-amber-600 hover:bg-amber-700">
          <MessageSquare className="w-4 h-4 mr-2" />
          Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact {companyName}</DialogTitle>
          <DialogDescription>
            Send an enquiry through MMC Direct. They&apos;ll receive an email notification.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-green-600 font-medium">Enquiry sent successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Quote for modular build"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your project or requirements..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading ? "Sending..." : "Send Enquiry"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
