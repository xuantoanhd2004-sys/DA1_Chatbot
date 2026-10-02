import subprocess
import os
import sys
import urllib.request
import time

def is_ollama_running():
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def start_servers():
    # Since start_all.py will be inside ai_engine folder
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    
    print("========================================================")
    print("Dang tu dong khoi chay toan bo he thong...")
    
    # 0. Khoi dong Ollama ngam (neu chua chay)
    if not is_ollama_running():
        print("- Dang khoi dong ban kinh Ollama (Local AI)... Vui long doi vai giay.")
        ollama_path = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
        if os.path.exists(ollama_path):
            # Fix xung dot GPU: ep Ollama chi dung NVIDIA GPU, tranh loi "Unable to init instance" tren may co 2 GPU (AMD iGPU + NVIDIA)
            env = os.environ.copy()
            env["CUDA_VISIBLE_DEVICES"] = "0"
            # Goi lenh serve ngam
            subprocess.Popen([ollama_path, "serve"], creationflags=subprocess.CREATE_NO_WINDOW, env=env)
            # Doi toi da 30 giay de khoi dong (lan dau mat ~10 giay)
            for _ in range(30):
                if is_ollama_running():
                    print("  -> Ollama da khoi dong thanh cong!")
                    break
                time.sleep(1)
        else:
            print("  [Canh bao] Khong tim thay phan mem Ollama! Bot se bao loi khi chat.")
    else:
        print("- Ollama (Local AI) dang chay on dinh.")

    # 1. LLM Python Backend (thay cho Rasa)
    print("Dang khoi chay Backend AI Server...")
    python_exe = os.path.join(project_root, "python310", "python.exe")
    
    log_file1 = open(os.path.join(base_dir, "llm_server.log"), "w", encoding="utf-8")
    llm_process = subprocess.Popen(
        f'"{python_exe}" -u llm_server.py', 
        cwd=base_dir, shell=True, stdout=log_file1, stderr=subprocess.STDOUT)
    
    # 2. Web Interface (Backend + Frontend)
    print("Dang khoi chay Giao dien Chatbot Web...")
    web_dir = os.path.join(project_root, "chatbot_ui")
    web_cmd = r"npm start"
    env = os.environ.copy()
    env["NODE_NO_WARNINGS"] = "1"
    
    log_file2 = open(os.path.join(base_dir, "web_server.log"), "w", encoding="utf-8")
    p2 = subprocess.Popen(web_cmd, cwd=web_dir, shell=True, env=env, stdout=log_file2, stderr=subprocess.STDOUT)
    
    # Kiem tra xem co process nao bi crash (vi du loi trung port)
    time.sleep(5)
    if llm_process.poll() is not None or p2.poll() is not None:
        print("\n[!] Khoi chay that bai! He thong gap loi (co the do cong 5000 hoac 3000 da bi xai).")
        if llm_process.poll() is not None:
             print(" -> Loi tai: Backend AI Server")
        if p2.poll() is not None:
             print(" -> Loi tai: Giao dien Chatbot Web")
        sys.exit(1)
        
    print("\n[OK] Khoi chay thanh cong tai dia chi: http://localhost:5000")

    try:
        llm_process.wait()
        p2.wait()
    except KeyboardInterrupt:
        print("\n[!] Dang tat he thong, dang don dep cac tien trinh ngam...")
        import subprocess as sp
        sp.run(f"taskkill /T /F /PID {llm_process.pid}", shell=True, stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        sp.run(f"taskkill /T /F /PID {p2.pid}", shell=True, stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        print("[OK] He thong da tat an toan.")

if __name__ == "__main__":
    start_servers()
