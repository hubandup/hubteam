import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Mail, Loader2 } from "lucide-react";
import logo from "@/assets/logo-hubandup.svg";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "already">("idle");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleUnsubscribe = async () => {
    if (!email) {
      setErrorMessage("Email non spécifié");
      setStatus("error");
      return;
    }

    setStatus("loading");
    
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: { email, reason },
      });

      if (error) {
        console.error("Unsubscribe error:", error);
        setErrorMessage("Une erreur s'est produite. Veuillez réessayer.");
        setStatus("error");
        return;
      }

      if (data?.alreadyUnsubscribed) {
        setStatus("already");
      } else {
        setStatus("success");
      }
    } catch (err) {
      console.error("Unsubscribe exception:", err);
      setErrorMessage("Une erreur s'est produite. Veuillez réessayer.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Hub & Up" className="h-10" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" />
            Désabonnement
          </CardTitle>
          <CardDescription>
            Gérez vos préférences email
          </CardDescription>
          {email && (
            <p className="mt-2 text-sm font-medium text-foreground bg-muted px-3 py-1.5 rounded-md inline-block">
              {email}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === "idle" && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Vous ne souhaitez plus recevoir nos communications ? 
                Cliquez sur le bouton ci-dessous pour vous désabonner.
              </p>
              
              
              
              <Button 
                onClick={handleUnsubscribe} 
                className="w-full"
                variant="destructive"
              >
                Se désabonner
              </Button>
            </>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Traitement en cours...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle className="h-12 w-12 text-primary" />
              <div>
                <p className="font-medium text-lg">Désabonnement confirmé</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Vous ne recevrez plus d'emails de prospection de notre part.
                </p>
              </div>
            </div>
          )}

          {status === "already" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium text-lg">Déjà désabonné</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Cette adresse email est déjà désabonnée de nos communications.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-medium text-lg">Erreur</p>
                <p className="text-muted-foreground text-sm mt-1">{errorMessage}</p>
              </div>
              <Button onClick={() => setStatus("idle")} variant="outline">
                Réessayer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
