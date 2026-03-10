import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Clock } from "lucide-react";

interface RankingData {
  approved: boolean;
  myRank?: {
    user_id: number;
    full_name: string;
    grade_level: number;
    stream: string | null;
    average_score: number;
    rank: number;
    total_subjects: number;
  };
  totalStudents?: number;
  message?: string;
}

export default function StudentRanking() {
  const { user, profile } = useAuth();
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.grade_level) return;
    
    const fetchRankings = async () => {
      try {
        const data = await api.getRankings({
          grade_level: profile.grade_level!,
          stream: profile.stream || undefined
        });
        
        setRankingData(data);
      } catch (err) {
        console.error("Failed to load rankings:", err);
      }
      setLoading(false);
    };
    
    fetchRankings();
  }, [user, profile]);

  if (loading) return null;

  // Rankings not yet approved by director
  if (!rankingData?.approved) {
    return (
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="bg-muted rounded-xl p-2.5">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Rankings Pending</p>
              <p className="text-xs">Rankings will be available once approved by the director.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const myRank = rankingData.myRank;
  
  if (!myRank) return null;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="gradient-accent p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl p-2.5">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/70">My Rank</p>
                <p className="text-2xl font-extrabold">{myRank.rank}<span className="text-sm font-normal text-white/70">/{rankingData.totalStudents || 0}</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/70">Average</p>
              <p className="text-2xl font-extrabold">{myRank.average_score.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
